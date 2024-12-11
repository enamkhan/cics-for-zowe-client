/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { getResource } from "@zowe/cics-for-zowe-sdk";
import { IProfile, IRestClientError, Session } from "@zowe/imperative";
import { imperative, Types, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import axios, { AxiosRequestConfig } from "axios";
import { window } from "vscode";
import { xml2json } from "xml-js";
import { CICSPlexTree } from "../trees/CICSPlexTree";
import cicsProfileMeta from "./profileDefinition";

export class ProfileManagement {
  private static zoweExplorerAPI = ZoweVsCodeExtension.getZoweExplorerApi();
  private static ProfilesCache = ProfileManagement.zoweExplorerAPI.getExplorerExtenderApi().getProfilesCache();

  constructor() { }

  public static apiDoesExist() {
    if (ProfileManagement.zoweExplorerAPI) {
      return true;
    }
    return false;
  }

  public static async registerCICSProfiles() {
    await ProfileManagement.zoweExplorerAPI.getExplorerExtenderApi().initForZowe("cics", cicsProfileMeta);
  }

  public static getExplorerApis() {
    return ProfileManagement.zoweExplorerAPI;
  }

  public static getProfilesCache() {
    return ProfileManagement.ProfilesCache;
  }

  public static async profilesCacheRefresh() {
    const apiRegiser: Types.IApiRegisterClient = ProfileManagement.getExplorerApis();
    await ProfileManagement.getProfilesCache().refresh(apiRegiser);
  }

  public static async createNewProfile(formResponse: imperative.ISaveProfile) {
    await ProfileManagement.ProfilesCache.getCliProfileManager("cics")?.save(formResponse);
    await ProfileManagement.getExplorerApis().getExplorerExtenderApi().reloadProfiles();
  }

  public static async updateProfile(formResponse: imperative.IUpdateProfile) {
    const profile: imperative.IProfileUpdated = await ProfileManagement.ProfilesCache.getCliProfileManager("cics")?.update(formResponse);
    await ProfileManagement.getExplorerApis().getExplorerExtenderApi().reloadProfiles();
    return profile;
  }

  public static async deleteProfile(formResponse: imperative.IDeleteProfile) {
    await ProfileManagement.ProfilesCache.getCliProfileManager("cics")?.delete(formResponse);
    await ProfileManagement.getExplorerApis().getExplorerExtenderApi().reloadProfiles();
  }

  public static async getConfigInstance(): Promise<imperative.ProfileInfo> {
    const mProfileInfo = await ProfileManagement.getProfilesCache().getProfileInfo();
    return mProfileInfo;
  }

  /**
   * Makes axios GET request with path and axios config object given
   * @param path
   * @param config
   * @returns
   */
  public static async makeRequest(path: string, config: AxiosRequestConfig) {
    const response = await axios.get(path, config);
    return response;
  }

  public static cmciResponseXml2Json(data: string) {
    return JSON.parse(xml2json(data, { compact: true, spaces: 4 }));
  }

  /**
   * Populates the info
   * @param profile
   * @returns Array of type InfoLoaded
   */
  public static async getPlexInfo(profile: imperative.IProfileLoaded): Promise<InfoLoaded[]> {

    const infoLoaded: InfoLoaded[] = [];
    const session = new Session({
      protocol: profile.profile.protocol,
      hostname: profile.profile.host,
      port: profile.profile.port,
      type: "basic",
      user: profile.profile.user,
      password: profile.profile.password,
      rejectUnauthorized: profile.profile.rejectUnauthorized,
    });

    let group = false;
    let managed = false;

    if (profile.profile.cicsPlex && profile.profile.regionName) {
      /**
       * If provided plex and region, check if it's a region group
       */
      try {
        const groupResponse = await getResource(session, {
          name: "CICSRegionGroup",
          cicsPlex: profile.profile.cicsPlex,
          regionName: profile.profile.regionName,
          criteria: `GROUP=${profile.profile.regionName}`,
        });

        managed = true;
        group = groupResponse.response.resultsummary &&
          groupResponse.response.resultsummary.recordcount &&
          groupResponse.response.resultsummary.recordcount !== "0";
      } catch (error) {
        if (error instanceof imperative.ImperativeError) {
          console.log(error.message);

        }
      }
    }

    if (!profile.profile.cicsPlex && !profile.profile.regionName) {

      try {
        const plexes = await getResource(session, {
          name: "CICSCICSPlex",
        });

        for (const plex of this.toArray<{ [key: string]: string; }>(plexes.response.records.cicscicsplex)) {
          infoLoaded.push({
            plexname: plex.plexname,
            regions: [],
            group: false,
          });
          return infoLoaded;
        }

      } catch (error) {

        let errorMsg = `${error}`;

        if ("mDetails" in error) {
          const details: IRestClientError = error.mDetails;

          if (details.errorCode && details.errorCode === "404") {
            // 404 means no plexes
          }

          errorMsg = details.msg;
        }
        window.showErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }
    }

    try {
      const regions = await this.getRegions(session, profile.profile, managed);
      infoLoaded.push({
        plexname: profile.profile.cicsPlex || null,
        regions,
        group,
      });
    } catch (error) {
      console.log(error);
    }

    return infoLoaded;
  }

  /**
   * Return all the regions in a given plex
   */
  public static async getRegionInfoInPlex(plex: CICSPlexTree) {
    try {
      const profile = plex.getProfile();
      const config: AxiosRequestConfig = {
        baseURL: `${profile.profile.protocol}://${profile.profile.host}:${profile.profile.port}/CICSSystemManagement`,
        auth: {
          username: profile.profile.user,
          password: profile.profile.password,
        },
      };
      const regionResponse = await ProfileManagement.makeRequest(`/CICSManagedRegion/${plex.getPlexName()}`, config);
      if (regionResponse.status === 200) {
        const jsonFromXml = ProfileManagement.cmciResponseXml2Json(regionResponse.data);
        if (jsonFromXml.response.records && jsonFromXml.response.records.cicsmanagedregion) {
          const returnedRegions = jsonFromXml.response.records.cicsmanagedregion.map((item: { _attributes: any; }) => item._attributes);
          return returnedRegions;
        }
      }
    } catch (error) {
      console.log(error);
      window.showErrorMessage(`Cannot find plex ${plex.getPlexName()} for profile ${plex.getParent().label}`);
      throw new Error("Plex Not Found");
    }
  }

  public static async generateCacheToken(profile: imperative.IProfileLoaded, plexName: string, resourceName: string, criteria?: string, group?: string) {
    try {
      const config: AxiosRequestConfig = {
        baseURL: `${profile.profile.protocol}://${profile.profile.host}:${profile.profile.port}/CICSSystemManagement`,
        auth: {
          username: profile.profile.user,
          password: profile.profile.password,
        },
        params: {
          OVERRIDEWARNINGCOUNT: "YES",
          CRITERIA: criteria,
          NODISCARD: "",
          SUMMONLY: "",
        },
      };
      const allProgramsResponse = await ProfileManagement.makeRequest(`/${resourceName}/${plexName}${group ? `/${group}` : ""}`, config);
      if (allProgramsResponse.status === 200) {
        const jsonFromXml = ProfileManagement.cmciResponseXml2Json(allProgramsResponse.data);
        if (jsonFromXml.response && jsonFromXml.response.resultsummary) {
          const resultsSummary = jsonFromXml.response.resultsummary._attributes;
          return { cacheToken: resultsSummary.cachetoken, recordCount: resultsSummary.recordcount };
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  public static async getCachedResources(profile: imperative.IProfileLoaded, cacheToken: string, resourceName: string, start = 1, increment = 800) {
    try {
      const config: AxiosRequestConfig = {
        baseURL: `${profile.profile.protocol}://${profile.profile.host}:${profile.profile.port}/CICSSystemManagement`,
        auth: {
          username: profile.profile.user,
          password: profile.profile.password,
        },
      };
      const allItemsResponse = await ProfileManagement.makeRequest(`/CICSResultCache/${cacheToken}/${start}/${increment}`, config);
      if (allItemsResponse.status === 200) {
        const jsonFromXml = ProfileManagement.cmciResponseXml2Json(allItemsResponse.data);
        if (jsonFromXml.response && jsonFromXml.response.records && jsonFromXml.response.records[resourceName.toLowerCase()]) {
          const recordAttributes = jsonFromXml.response.records[resourceName.toLowerCase()];
          const recordAttributesArr = Array.isArray(recordAttributes) ? recordAttributes : [recordAttributes];
          const returnedResources = recordAttributesArr.map((item: { _attributes: any; }) => item._attributes);
          return returnedResources;
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  public static toArray<T>(input: T | T[]): T[] {
    return Array.isArray(input) ? input : [input];
  }

  public static async getRegions(session: Session, profile: IProfile, managed: boolean = true) {
    const regionResponse = await getResource(session, {
      name: managed ? "CICSManagedRegion" : "CICSRegion",
      ...profile.cicsPlex ? {
        cicsPlex: `${profile.cicsPlex}`
      } : {},
      ...profile.regionName ? {
        regionName: `${profile.regionName}`
      } : {},
    });

    if (!regionResponse.response.records[managed ? "cicsmanagedregion" : "cicsregion"]) {
      throw Error(`Error retrieving /CICSManagedRegion/${profile.cicsPlex}/${profile.regionName}`);
    }

    return this.toArray<{ [key: string]: string; }>(regionResponse.response.records[managed ? "cicsmanagedregion" : "cicsregion"]);
  }
}

export interface InfoLoaded {
  plexname: string | null;
  regions: any[];
  group: boolean;
}

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

import { ImperativeExpect } from "@zowe/imperative";
import { CicsCmciConstants } from "../../constants";
import { IResourceParms } from "../../doc";

/**
 * Get uri for requesting a resources in CICS through CMCI REST API
 * @param {string} cicsPlexName - CICSplex name
 * @param {string} regionName - CICS region name
 * @param {string} resourceName - CMCI resource name
 * @param {string} criteria - criteria string
 * @param {string} parameter - parameter string
 * @returns {string} return a string containing the resource uri
 */
export function getResourceUri(params: IResourceParms): string {
  ImperativeExpect.toBeDefinedAndNonBlank(params.name, "CICS Resource name", "CICS resource name is required");

  let delimiter = "?"; // initial delimiter

  const cicsPlex = params.cicsPlex ? CicsCmciConstants.SEPERATOR + params.cicsPlex : "";
  const region = params.regionName ? CicsCmciConstants.SEPERATOR + params.regionName : "";

  let cmciResource = CicsCmciConstants.SEPERATOR + CicsCmciConstants.CICS_SYSTEM_MANAGEMENT +
    CicsCmciConstants.SEPERATOR + params.name + cicsPlex + region;

  if (params.criteria && params.criteria.length > 0) {
    let addParentheses = params.criteria.charAt(0) !== '(';

    cmciResource += delimiter + "CRITERIA=" + (addParentheses ? "(" : "") + encodeURIComponent(params.criteria) + (addParentheses ? ")" : "");
    delimiter = "&";
  }

  if (params.parameter && params.parameter.length > 0) {
    cmciResource += delimiter + "PARAMETER=" + encodeURIComponent(params.parameter);
    delimiter = "&";
  }

  if (params.queryParams && params.queryParams.summonly) {
    cmciResource += delimiter + "SUMMONLY";
    delimiter = "&";
  }

  if (params.queryParams && params.queryParams.nodiscard) {
    cmciResource += delimiter + "NODISCARD";
    delimiter = "&";
  }

  return cmciResource;
}

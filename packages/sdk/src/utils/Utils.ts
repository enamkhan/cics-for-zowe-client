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
import { CicsCmciConstants } from "../constants";
import { IGetResourceUriOptions } from "../doc";

/**
 * Class for providing static utility methods
 * @export
 * @class Utils
 */
export class Utils {

  /**
   * Get uri for requesting a resources in CICS through CMCI REST API
   * @param {string} resourceName - CMCI resource name
   * @param {IGetResourceUriOptions} options - CMCI resource options
   */
  public static getResourceUri(resourceName: string, options?: IGetResourceUriOptions): string {
    ImperativeExpect.toBeDefinedAndNonBlank(resourceName, "CICS Resource name", "CICS resource name is required");

    let delimiter = "?"; // initial delimiter

    const cicsPlex = (options && options.cicsPlex) == null ? "" : options.cicsPlex + CicsCmciConstants.SEPERATOR;
    const region = (options && options.regionName) == null ? "" : options.regionName;

    let cmciResource = CicsCmciConstants.SEPERATOR + CicsCmciConstants.CICS_SYSTEM_MANAGEMENT +
      CicsCmciConstants.SEPERATOR + resourceName + CicsCmciConstants.SEPERATOR +
      cicsPlex + region;

    if (options && options.criteria) {
      cmciResource += `${delimiter}${CicsCmciConstants.CRITERIA}=${this.enforceParentheses(encodeURIComponent(options.criteria))}`;
      delimiter = "&";
    }

    if (options && options.parameter) {
      cmciResource += `${delimiter}PARAMETER=${encodeURIComponent(options.parameter)}`;
      delimiter = "&";
    }

    if (options && options.queryParams && options.queryParams.summonly) {
      cmciResource += `${delimiter}${CicsCmciConstants.SUMM_ONLY}`;
      delimiter = "&";
    }

    if (options && options.queryParams && options.queryParams.nodiscard) {
      cmciResource += `${delimiter}${CicsCmciConstants.NO_DISCARD}`;
      delimiter = "&";
    }

    if (options && options.queryParams && options.queryParams.overrideWarningCount) {
      cmciResource += `${delimiter}${CicsCmciConstants.OVERRIDE_WARNING_COUNT}`;
      delimiter = "&";
    }

    return cmciResource;
  }

  public static enforceParentheses(input: string): string {
    if (!input.startsWith('(') && !input.endsWith(')')) {
      return `(${input})`;
    } else if (input.startsWith('(') && !input.endsWith(')')) {
      return `${input})`;
    } else if (!input.startsWith('(') && input.endsWith(')')) {
      return `(${input}`;
    }
    return input;
  }
}

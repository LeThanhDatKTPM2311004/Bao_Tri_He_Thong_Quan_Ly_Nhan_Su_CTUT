import {
  ORG_CODE_REGEX,
  ORG_NAME_REGEX,
  assertValidOrgCode,
  assertValidOrgName,
} from './organizationText.js';

export const KHOA_CODE_REGEX = ORG_CODE_REGEX;
export const KHOA_NAME_REGEX = ORG_NAME_REGEX;

export const assertValidKhoaCode = (value) => assertValidOrgCode(value, 'Mã khoa');
export const assertValidKhoaName = (value) => assertValidOrgName(value, 'Tên khoa');

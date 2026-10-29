import {
  ORG_FIELD_MAX_LENGTH,
  ORG_CODE_MAX_LENGTH,
  createOrgCodeDuplicateRule,
  createOrgCodePatternRule,
  createOrgNamePatternRule,
  orgCodeMaxLengthRule,
  orgFieldMaxLengthRule,
} from './organizationValidation';

export const KHOA_FIELD_MAX_LENGTH = ORG_FIELD_MAX_LENGTH;
export const KHOA_CODE_MAX_LENGTH = ORG_CODE_MAX_LENGTH;
export const khoaMaxLengthRule = orgFieldMaxLengthRule;
export const khoaCodeMaxLengthRule = orgCodeMaxLengthRule;
export const khoaCodePatternRule = createOrgCodePatternRule('Mã khoa');
export const khoaNamePatternRule = createOrgNamePatternRule('Tên khoa');
export const createKhoaCodeDuplicateRule = (existingCodes: string[], isEditing = false) =>
  createOrgCodeDuplicateRule('Mã khoa', existingCodes, isEditing);

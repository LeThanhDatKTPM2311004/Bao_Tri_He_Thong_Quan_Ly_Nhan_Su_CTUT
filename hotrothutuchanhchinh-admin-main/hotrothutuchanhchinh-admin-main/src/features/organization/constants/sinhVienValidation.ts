import {
  ORG_FIELD_MAX_LENGTH,
  ORG_CODE_MAX_LENGTH,
  createOrgCodeDuplicateRule,
  createOrgCodePatternRule,
  createOrgNamePatternRule,
  orgCodeMaxLengthRule,
  orgFieldMaxLengthRule,
} from './organizationValidation';

export const SV_FIELD_MAX_LENGTH = ORG_FIELD_MAX_LENGTH;
export const SV_CODE_MAX_LENGTH = ORG_CODE_MAX_LENGTH;
export const svCodeMaxLengthRule = orgCodeMaxLengthRule;
export const svNameMaxLengthRule = orgFieldMaxLengthRule;
export const svCodePatternRule = createOrgCodePatternRule('Mã SV');
export const svNamePatternRule = createOrgNamePatternRule('Họ tên');
export const createSvCodeDuplicateRule = (existingCodes: string[], isEditing = false) =>
  createOrgCodeDuplicateRule('Mã SV', existingCodes, isEditing);

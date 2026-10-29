import {
  ORG_FIELD_MAX_LENGTH,
  ORG_CODE_MAX_LENGTH,
  createOrgCodeDuplicateRule,
  createOrgCodePatternRule,
  createOrgNamePatternRule,
  orgCodeMaxLengthRule,
  orgFieldMaxLengthRule,
} from './organizationValidation';

export const GV_FIELD_MAX_LENGTH = ORG_FIELD_MAX_LENGTH;
export const GV_CODE_MAX_LENGTH = ORG_CODE_MAX_LENGTH;
export const gvCodeMaxLengthRule = orgCodeMaxLengthRule;
export const gvNameMaxLengthRule = orgFieldMaxLengthRule;
export const gvCodePatternRule = createOrgCodePatternRule('Mã GV');
export const gvNamePatternRule = createOrgNamePatternRule('Họ tên');
export const createGvCodeDuplicateRule = (existingCodes: string[], isEditing = false) =>
  createOrgCodeDuplicateRule('Mã GV', existingCodes, isEditing);

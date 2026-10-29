import {
  ACADEMIC_YEAR_LENGTH,
  ORG_FIELD_MAX_LENGTH,
  academicYearRule,
  createOrgCodeDuplicateRule,
  createOrgCodePatternRule,
  createOrgNamePatternRule,
  orgFieldMaxLengthRule,
} from './organizationValidation';

export { ACADEMIC_YEAR_LENGTH, academicYearRule };

export const LOP_FIELD_MAX_LENGTH = ORG_FIELD_MAX_LENGTH;
export const lopMaxLengthRule = orgFieldMaxLengthRule;
export const lopCodePatternRule = createOrgCodePatternRule('Mã lớp');
export const lopNamePatternRule = createOrgNamePatternRule('Tên lớp');
export const createLopCodeDuplicateRule = (existingCodes: string[], isEditing = false) =>
  createOrgCodeDuplicateRule('Mã lớp', existingCodes, isEditing);

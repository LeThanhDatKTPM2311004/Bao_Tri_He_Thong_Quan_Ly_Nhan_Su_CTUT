import { organizationApi } from '../services/organizationApi';

export const loadAllOrgEmails = async () => {
  const [svRes, gvRes] = await Promise.all([
    organizationApi.sinhViens.list({ limit: 500, isActive: 'all' }),
    organizationApi.giangViens.list({ limit: 500, isActive: 'all' }),
  ]);

  return [...new Set(
    [...svRes.data.data, ...gvRes.data.data]
      .map((item) => item.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  )];
};

import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export type AdminChatAction = {
  type: string;
  path?: string;
  label?: string;
};

export type AdminChatAskResult = {
  intent?: string;
  confidence?: number;
  answer: string;
  actions?: AdminChatAction[];
  suggestions?: string[];
  sources?: string[];
};

export const adminChatbotApi = {
  suggestions: async (): Promise<string[]> => {
    const { data } = await axiosInstance.get(API_ENDPOINTS.CHATBOT.ADMIN_SUGGESTIONS, {
      skipGlobalLoading: true,
    });
    return data?.data ?? [];
  },

  ask: async (message: string): Promise<AdminChatAskResult> => {
    const { data } = await axiosInstance.post(
      API_ENDPOINTS.CHATBOT.ADMIN_ASK,
      { message },
      { skipGlobalLoading: true },
    );
    return data?.data;
  },
};

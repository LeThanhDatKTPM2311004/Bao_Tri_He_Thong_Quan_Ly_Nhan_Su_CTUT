import { ValidationError } from '../../shared/errors/AppError.js';
import * as chatbotService from './chatbot.service.js';
import * as adminChatbotService from './adminChatbot.service.js';

export const ask = async (req, res) => {
  const message = req.body?.message;
  if (message == null || String(message).trim() === '') {
    throw new ValidationError('Vui lòng nhập nội dung câu hỏi');
  }
  if (String(message).length > 1000) {
    throw new ValidationError('Câu hỏi tối đa 1000 ký tự');
  }

  const data = await chatbotService.ask({
    message: String(message),
    user: req.user || null,
  });

  return res.json({ success: true, data });
};

export const suggestions = async (_req, res) => {
  return res.json({
    success: true,
    data: chatbotService.getSuggestions(),
  });
};

export const askAdmin = async (req, res) => {
  const message = req.body?.message;
  if (message == null || String(message).trim() === '') {
    throw new ValidationError('Vui lòng nhập nội dung câu hỏi');
  }
  if (String(message).length > 2000) {
    throw new ValidationError('Câu hỏi tối đa 2000 ký tự');
  }

  const data = await adminChatbotService.askAdmin({
    message: String(message),
    user: req.user || null,
  });

  return res.json({ success: true, data });
};

export const suggestionsAdmin = async (_req, res) => {
  return res.json({
    success: true,
    data: adminChatbotService.getAdminSuggestions(),
  });
};

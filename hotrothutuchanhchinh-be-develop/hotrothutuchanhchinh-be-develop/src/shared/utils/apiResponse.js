export const successResponse = (res, data, message = 'Success', statusCode = 200, meta = null) => {
  const response = { success: true, data, message };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const errorResponse = (res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = []) => {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
  });
};

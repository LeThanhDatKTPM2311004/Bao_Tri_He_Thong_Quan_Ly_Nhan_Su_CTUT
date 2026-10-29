export const paginationSchema = {
  page: 1,
  limit: 10,
  maxLimit: 100,
};

export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || paginationSchema.page);
  const limit = Math.min(
    paginationSchema.maxLimit,
    Math.max(1, parseInt(query.limit, 10) || paginationSchema.limit),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildPaginationMeta = (total, page, limit) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

type QueryWithRange<T = any> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }> | { then: (onfulfilled?: any, onrejected?: any) => any };
};

export async function fetchAllRows<T = any>(query: QueryWithRange<T>, pageSize = 1000): Promise<T[]> {
  let allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    allRows = allRows.concat(page);

    if (page.length < pageSize) {
      return allRows;
    }

    from += pageSize;
  }
}
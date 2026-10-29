import { Table, type TableProps, type TableColumnType } from 'antd';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useCallback, useEffect, useRef, useState } from 'react';

type ResponsiveTableProps<T extends object> = Omit<TableProps<T>, 'scroll'> & {
  /** Thanh cuộn ngang phía trên danh sách (mặc định bật). */
  topScrollbar?: boolean;
  /** `false` = bảng co giãn theo khung, không ép min-width ngang. */
  scroll?: TableProps<T>['scroll'] | false;
};

const isActionColumn = <T,>(col: TableColumnType<T>) => {
  const key = String(col.key ?? col.dataIndex ?? '').toLowerCase();
  const title = typeof col.title === 'string' ? col.title.toLowerCase() : '';
  return (
    key === 'actions' ||
    key === 'action' ||
    key === 'thaoTac' ||
    title.includes('thao tác') ||
    col.fixed === 'right'
  );
};

/** Tự gắn ellipsis cho cột chữ; cột thao tác không cắt. */
function normalizeColumns<T extends object>(
  columns: TableProps<T>['columns'],
): TableProps<T>['columns'] {
  if (!columns) return columns;
  return columns.map((col) => {
    if (!col || !('title' in col)) return col;
    const c = col as TableColumnType<T>;
    if (isActionColumn(c)) {
      return {
        ...c,
        ellipsis: c.ellipsis ?? false,
        className: [c.className, 'app-table-actions-col'].filter(Boolean).join(' '),
      };
    }
    if (c.ellipsis !== undefined) return c;
    return { ...c, ellipsis: true };
  });
}

export function ResponsiveTable<T extends object>({
  topScrollbar = true,
  ...props
}: ResponsiveTableProps<T>) {
  const { isMobile } = useBreakpoint();
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  const { scroll, size, className, pagination, columns, ...rest } = props;

  const mergedColumns = normalizeColumns(columns);

  const mergedScroll =
    scroll === false
      ? undefined
      : scroll === undefined
        ? { x: 'max-content' as const }
        : scroll;

  const mergedPagination =
    pagination === false
      ? false
      : {
          showSizeChanger: !isMobile,
          responsive: true,
          showLessItems: isMobile,
          ...pagination,
        };

  const getTableScroller = useCallback(() => {
    const root = bottomRef.current;
    if (!root) return null;
    return (
      (root.querySelector('.ant-table-content') as HTMLElement | null) ||
      (root.querySelector('.ant-table-body') as HTMLElement | null) ||
      root
    );
  }, []);

  const measure = useCallback(() => {
    const scroller = getTableScroller();
    if (!scroller) return;
    setScrollWidth(scroller.scrollWidth);
  }, [getTableScroller]);

  useEffect(() => {
    if (!topScrollbar) return;
    measure();
    const scroller = getTableScroller();
    if (!scroller) return;

    const onBottomScroll = () => {
      if (syncing.current || !topRef.current) return;
      syncing.current = true;
      topRef.current.scrollLeft = scroller.scrollLeft;
      syncing.current = false;
    };

    scroller.addEventListener('scroll', onBottomScroll, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(scroller);
    const table = scroller.querySelector('table');
    if (table) ro.observe(table);

    return () => {
      scroller.removeEventListener('scroll', onBottomScroll);
      ro.disconnect();
    };
  }, [getTableScroller, measure, topScrollbar, props.dataSource, props.loading, mergedColumns]);

  const onTopScroll = () => {
    if (syncing.current || !topRef.current) return;
    const scroller = getTableScroller();
    if (!scroller) return;
    syncing.current = true;
    scroller.scrollLeft = topRef.current.scrollLeft;
    syncing.current = false;
  };

  const normalizeLoading = (loading: TableProps<T>['loading']) => {
    if (!loading) return loading;
    if (loading === true) {
      return { spinning: true, tip: 'Đang tải...' };
    }
    if (typeof loading === 'object') {
      return { tip: 'Đang tải...', ...loading };
    }
    return loading;
  };

  return (
    <div className="w-full min-w-0 max-w-full" ref={bottomRef}>
      {topScrollbar && (
        <div
          ref={topRef}
          onScroll={onTopScroll}
          className="w-full overflow-x-auto overflow-y-hidden mb-1"
          style={{ height: 14 }}
          aria-label="Thanh cuộn ngang danh sách"
        >
          <div style={{ width: Math.max(scrollWidth, 1), height: 1 }} />
        </div>
      )}
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <Table<T>
          {...rest}
          columns={mergedColumns}
          loading={normalizeLoading(rest.loading)}
          size={size ?? (isMobile ? 'small' : 'middle')}
          scroll={mergedScroll}
          pagination={mergedPagination}
          className={['app-responsive-table', className].filter(Boolean).join(' ')}
          tableLayout="auto"
        />
      </div>
    </div>
  );
}

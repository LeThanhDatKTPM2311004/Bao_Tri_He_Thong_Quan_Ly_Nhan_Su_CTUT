import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AutoComplete, Button, Empty, Modal, Spin, Input } from 'antd';
import {
  FileTextOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { isAdmin, isStaff } from '@/shared/constants/roleGroups';
import { getSidebarMenuItems } from '@/shared/constants/menuConfig';
import { organizationApi } from '@/features/organization/services/organizationApi';
import { usersApi } from '@/features/users/services/usersApi';
import { wordTemplatesApi } from '@/features/forms/services/formsApi';
import { workflowsApi } from '@/features/workflows/services/workflowsApi';
import type { SinhVien } from '@/features/organization/types/organization.types';
import type { UserListItem } from '@/features/users/types/users.types';
import type { ImportedForm } from '@/features/forms/types/forms.types';
import type { PendingTask, ProcessedTask } from '@/features/workflows/types/workflows.types';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

type SearchKind = 'menu' | 'form' | 'student' | 'user' | 'dossier';

type SearchHit = {
  key: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  path: string;
};

const KIND_META: Record<SearchKind, { label: string; icon: ReactNode }> = {
  menu: { label: 'Trang', icon: <SearchOutlined /> },
  form: { label: 'Thủ tục / mẫu đơn', icon: <FileTextOutlined /> },
  student: { label: 'Sinh viên', icon: <TeamOutlined /> },
  user: { label: 'Người dùng', icon: <UserOutlined /> },
  dossier: { label: 'Hồ sơ', icon: <FolderOpenOutlined /> },
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const matchesQuery = (haystack: string, query: string) => {
  const q = normalize(query);
  if (!q) return false;
  return normalize(haystack).includes(q);
};

const lopIdOf = (sv: SinhVien) =>
  typeof sv.lopId === 'string' ? sv.lopId : sv.lopId?._id || '';

const lopNameOf = (sv: SinhVien) => {
  if (sv.lopHoc) return sv.lopHoc;
  if (typeof sv.lopId === 'object' && sv.lopId?.name) return sv.lopId.name;
  if (typeof sv.lopId === 'object' && sv.lopId?.code) return sv.lopId.code;
  return '';
};

async function runGlobalSearch(query: string, role?: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const admin = isAdmin(role);
  const staff = isStaff(role);
  const hits: SearchHit[] = [];

  const menuHits = getSidebarMenuItems(role)
    .filter((item) => matchesQuery(`${item.label} ${item.key}`, q))
    .slice(0, 5)
    .map((item) => ({
      key: `menu-${item.key}`,
      kind: 'menu' as const,
      title: item.label,
      subtitle: item.key,
      path: item.key,
    }));
  hits.push(...menuHits);

  const tasks: Array<Promise<void>> = [];

  if (admin) {
    tasks.push(
      (async () => {
        const [svRes, userRes, formRes] = await Promise.allSettled([
          organizationApi.sinhViens.list({ search: q, limit: 8, isActive: 'all' }),
          usersApi.getAll({ search: q, limit: 8 }),
          wordTemplatesApi.list(),
        ]);

        if (svRes.status === 'fulfilled') {
          const students = svRes.value.data.data || [];
          hits.push(
            ...students.map((sv) => {
              const lopId = lopIdOf(sv);
              const params = new URLSearchParams();
              if (lopId) params.set('lopId', lopId);
              params.set('q', sv.maSV || q);
              return {
                key: `student-${sv._id}`,
                kind: 'student' as const,
                title: `${sv.maSV} — ${sv.fullName}`,
                subtitle: lopNameOf(sv) || sv.email || 'Sinh viên',
                path: `/organization/lop-sinh-vien?${params.toString()}`,
              };
            }),
          );
        }

        if (userRes.status === 'fulfilled') {
          const users = (userRes.value.data.data || []) as UserListItem[];
          hits.push(
            ...users.slice(0, 8).map((u) => ({
              key: `user-${u._id}`,
              kind: 'user' as const,
              title: u.fullName,
              subtitle: [u.email, u.studentId, u.role].filter(Boolean).join(' · '),
              path: `/users?search=${encodeURIComponent(u.email || u.studentId || u.fullName || q)}`,
            })),
          );
        }

        if (formRes.status === 'fulfilled') {
          const forms = (formRes.value.data.data || []) as ImportedForm[];
          hits.push(
            ...forms
              .filter((f) => matchesQuery(`${f.tenDon} ${f.description || ''}`, q))
              .slice(0, 8)
              .map((f) => ({
                key: `form-${f._id}`,
                kind: 'form' as const,
                title: f.tenDon,
                subtitle: f.isActive === false ? 'Ngừng hoạt động' : 'Mẫu Word',
                path: `/forms?q=${encodeURIComponent(f.tenDon)}`,
              })),
          );
        }
      })(),
    );
  }

  if (staff || admin) {
    tasks.push(
      (async () => {
        const [pendingRes, processedRes] = await Promise.allSettled([
          staff ? workflowsApi.getPending() : Promise.reject(new Error('skip')),
          staff ? workflowsApi.getProcessed() : Promise.reject(new Error('skip')),
        ]);

        const dossiers: Array<PendingTask | ProcessedTask> = [];
        if (pendingRes.status === 'fulfilled') {
          dossiers.push(...(pendingRes.value.data.data || []));
        }
        if (processedRes.status === 'fulfilled') {
          dossiers.push(...(processedRes.value.data.data || []));
        }

        const filtered = dossiers
          .filter((t) =>
            matchesQuery(
              `${t.submissionCode} ${t.formName} ${t.submittedBy} ${t.currentStep}`,
              q,
            ),
          )
          .slice(0, 8);

        hits.push(
          ...filtered.map((t) => ({
            key: `dossier-${t.submissionId}`,
            kind: 'dossier' as const,
            title: `${t.submissionCode} — ${t.formName}`,
            subtitle: `${t.submittedBy} · ${t.currentStep}`,
            path: `/workflows/pending?q=${encodeURIComponent(t.submissionCode || q)}`,
          })),
        );
      })(),
    );
  }

  await Promise.all(tasks);

  const order: SearchKind[] = ['menu', 'form', 'student', 'user', 'dossier'];
  hits.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return hits.slice(0, 24);
}

type HeaderGlobalSearchProps = {
  /** @deprecated — tự nhận theo breakpoint */
  compact?: boolean;
};

export function HeaderGlobalSearch(_props: HeaderGlobalSearchProps = {}) {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { isMobile } = useBreakpoint();
  const inputRef = useRef<any>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 320);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    runGlobalSearch(debounced, user?.role)
      .then((results) => {
        if (!cancelled) setHits(results);
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, user?.role]);

  const focusSearch = useCallback(() => {
    if (isMobile) {
      setModalOpen(true);
      return;
    }
    setDropdownOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }, [isMobile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusSearch]);

  const goToHit = useCallback(
    (hit?: SearchHit) => {
      if (!hit) return;
      setDropdownOpen(false);
      setModalOpen(false);
      setQuery('');
      setHits([]);
      navigate(hit.path);
    },
    [navigate],
  );

  const options = useMemo(
    () =>
      hits.map((hit) => ({
        value: hit.key,
        label: (
          <div className="flex items-start gap-2 py-1">
            <span className="mt-0.5 text-[var(--app-accent)]">{KIND_META[hit.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[var(--app-text-muted)] mb-0.5">
                {KIND_META[hit.kind].label}
              </div>
              <div className="font-medium text-[var(--app-text)] truncate">{hit.title}</div>
              {hit.subtitle ? (
                <div className="text-xs text-[var(--app-text-muted)] truncate">{hit.subtitle}</div>
              ) : null}
            </div>
          </div>
        ),
      })),
    [hits],
  );

  const searchField = (
    <AutoComplete
      className="w-full"
      options={options}
      open={dropdownOpen && debounced.length >= 2}
      onDropdownVisibleChange={setDropdownOpen}
      value={query}
      onChange={(value) => {
        // Khi chọn option, value là key — bỏ qua, onSelect sẽ điều hướng
        if (hits.some((h) => h.key === value)) return;
        setQuery(value);
      }}
      onSelect={(key) => goToHit(hits.find((h) => h.key === key))}
      notFoundContent={
        loading ? (
          <div className="py-4 text-center">
            <Spin size="small" />
          </div>
        ) : debounced.length >= 2 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có kết quả" />
        ) : null
      }
    >
      <Input
        ref={inputRef}
        prefix={<SearchOutlined className="text-slate-400 mr-1" />}
        suffix={
          <span className="text-[10px] font-semibold bg-[var(--app-bg)] px-1.5 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-text-muted)] select-none hidden lg:inline">
            Ctrl K
          </span>
        }
        placeholder="Tìm thủ tục, hồ sơ, mã sinh viên…"
        className="rounded-lg"
        allowClear
        onPressEnter={() => {
          if (hits[0]) goToHit(hits[0]);
        }}
      />
    </AutoComplete>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="text"
          icon={<SearchOutlined className="text-lg" />}
          onClick={() => setModalOpen(true)}
          className="!w-10 !h-10 flex items-center justify-center"
          aria-label="Tìm kiếm"
        />
        <Modal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          title="Tìm kiếm"
          destroyOnClose
        >
          {searchField}
          <p className="text-xs text-[var(--app-text-muted)] mt-3 mb-0">
            Nhập ít nhất 2 ký tự: thủ tục, mã hồ sơ, mã SV, tên người dùng…
          </p>
        </Modal>
      </>
    );
  }

  return searchField;
}

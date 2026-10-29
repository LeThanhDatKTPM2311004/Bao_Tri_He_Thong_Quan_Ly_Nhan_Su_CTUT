import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Space, message, Modal } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { PendingTasksTable } from '../components/PendingTasksTable';
import { SignApproveModal, type SignApprovePayload } from '../components/SignApproveModal';
import { BulkProcessModal } from '../components/BulkProcessModal';
import { WorkflowStepConfig } from '../components/WorkflowStepConfig';
import { workflowsApi } from '../services/workflowsApi';
import type { PendingTask, StaffProcessMode } from '../types/workflows.types';
import { useAppSelector } from '@/store/hooks';
import { ROLES } from '@/shared/constants/roles';
import { isStaff } from '@/shared/constants/roleGroups';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useSearchParams } from 'react-router-dom';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const BULK_MAX = 50;

export function PendingApprovalsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === ROLES.ADMIN;
  const isStaffUser = isStaff(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const isPhongAssistant = user?.role === ROLES.PHONG_ASSISTANT;
  const pageTitle = isAdmin
    ? 'Quản lý quy trình'
    : isPhongAssistant
      ? 'Hồ sơ chờ kiểm tra'
      : 'Hồ sơ chờ ký';
  const pageSubtitle = isAdmin
    ? 'Cấu hình thứ tự các bước duyệt hồ sơ'
    : isPhongAssistant
      ? 'Kiểm tra hồ sơ. Nếu còn sai, trả về sinh viên và ghi lý do.'
      : 'Chọn nhiều hồ sơ để duyệt / ký hàng loạt, hoặc xử lý từng hồ sơ';

  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PendingTask | null>(null);
  const [processMode, setProcessMode] = useState<StaffProcessMode>('approve');
  const [filterQuery, setFilterQuery] = useState(() => searchParams.get('q') || '');
  const [formFilter, setFormFilter] = useState<string | undefined>(
    () => searchParams.get('form') || undefined,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<StaffProcessMode | 'reject'>('approve');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    setFilterQuery(searchParams.get('q') || '');
    setFormFilter(searchParams.get('form') || undefined);
  }, [searchParams]);

  const formOptions = useMemo(() => {
    const names = [...new Set(tasks.map((t) => t.formName).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'vi'),
    );
    return names.map((name) => ({ value: name, label: name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (formFilter) {
      list = list.filter((t) => t.formName === formFilter);
    }
    const q = filterQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) =>
      `${t.submissionCode} ${t.formName} ${t.submittedBy} ${t.currentStep}`
        .toLowerCase()
        .includes(q),
    );
  }, [tasks, filterQuery, formFilter]);

  const selectedTasks = useMemo(
    () => filteredTasks.filter((t) => selectedRowKeys.includes(t.submissionId)),
    [filteredTasks, selectedRowKeys],
  );

  const fetchPending = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const response = await workflowsApi.getPending();
      setTasks(response.data.data);
    } catch (error) {
      if (!opts?.silent) {
        message.error(getErrorMessage(error) || 'Không thể tải danh sách hồ sơ chờ duyệt');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isStaffUser) return;
    fetchPending();
  }, [fetchPending, isStaffUser]);

  useLiveRefresh(() => {
    if (!isStaffUser) return;
    return fetchPending({ silent: true });
  });

  const updateSearchParams = (q: string, form?: string) => {
    const next = new URLSearchParams(searchParams);
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    if (form) next.set('form', form);
    else next.delete('form');
    setSearchParams(next, { replace: true });
  };

  const promptComment = (title: string): Promise<string | null> =>
    new Promise((resolve) => {
      let comment = '';
      Modal.confirm({
        title,
        content: (
          <Input.TextArea
            rows={3}
            placeholder="Ghi chú (tuỳ chọn)"
            onChange={(e) => {
              comment = e.target.value;
            }}
          />
        ),
        onOk: () => resolve(comment || null),
        onCancel: () => resolve(null),
      });
    });

  const handleProcessClick = (fileId: string, mode: StaffProcessMode) => {
    const task = tasks.find((item) => item.submissionId === fileId) || null;
    setSelectedTask(task);
    setProcessMode(mode);
    setSignModalOpen(true);
  };

  const handleConfirmApprove = async (payload: SignApprovePayload) => {
    if (!selectedTask) return;
    try {
      setApproving(true);
      await workflowsApi.approve(selectedTask.submissionId, {
        action: payload.action,
        comment: payload.comment,
        signature: payload.signature,
      });
      message.success(
        payload.action === 'handwritten'
          ? 'Đã ký tay và duyệt hồ sơ — PDF đã được dán chữ ký'
          : payload.action === 'sign'
            ? 'Đã ký số và duyệt hồ sơ — PDF đã được dán chữ ký'
            : 'Đã duyệt hồ sơ — chuyển sang bước tiếp theo',
      );
      setSignModalOpen(false);
      setSelectedTask(null);
      fetchPending();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Duyệt / ký số thất bại');
    } finally {
      setApproving(false);
    }
  };

  const handleReturn = async (fileId: string) => {
    const task = tasks.find((item) => item.submissionId === fileId);
    const title = task?.returnTo === 'previous' ? 'Trả về bước trước' : 'Trả về sinh viên';
    const comment = await new Promise<string | null>((resolve) => {
      let value = '';
      Modal.confirm({
        title,
        content: (
          <Input.TextArea
            rows={3}
            placeholder="Nhập lý do (ít nhất 5 ký tự)"
            onChange={(e) => {
              value = e.target.value;
            }}
          />
        ),
        okText: 'Trả hồ sơ',
        onOk: () => {
          const reason = value.trim();
          if (reason.length < 5) {
            message.warning('Vui lòng nhập lý do (ít nhất 5 ký tự)');
            return Promise.reject(new Error('short'));
          }
          resolve(reason);
          return undefined;
        },
        onCancel: () => resolve(null),
      });
    });
    if (!comment) return;
    try {
      await workflowsApi.returnToStudent(fileId, { comment });
      message.success(task?.returnTo === 'previous' ? 'Đã trả về bước trước' : 'Đã trả hồ sơ cho sinh viên');
      fetchPending();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Trả hồ sơ thất bại');
    }
  };

  const handleReject = async (fileId: string) => {
    const comment = await promptComment('Xác nhận từ chối hồ sơ');
    if (comment === null) return;
    try {
      await workflowsApi.reject(fileId, { comment: comment || undefined });
      message.warning('Đã từ chối hồ sơ');
      fetchPending();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Từ chối hồ sơ thất bại');
    }
  };

  const handleView = async (task: PendingTask) => {
    if (!task.fileUrl) {
      message.warning('Hồ sơ này chưa có file đính kèm để xem');
      return;
    }
    try {
      const blob = await workflowsApi.viewSubmissionFile(task.fileUrl);
      const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      const isPdf = String.fromCharCode(...header) === '%PDF-';
      if (!isPdf) {
        message.error('Chưa có bản PDF. Thử lại sau vài giây (đang chuyển Word → PDF).');
        return;
      }
      const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
      const fileUrl = URL.createObjectURL(pdfBlob);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể mở file hồ sơ');
    }
  };

  const openBulk = (mode: StaffProcessMode | 'reject') => {
    if (!selectedTasks.length) {
      message.warning('Vui lòng chọn ít nhất một hồ sơ');
      return;
    }
    if (selectedTasks.length > BULK_MAX) {
      message.warning(`Mỗi lần xử lý tối đa ${BULK_MAX} hồ sơ`);
      return;
    }
    if ((mode === 'sign' || mode === 'handwritten') && new Set(selectedTasks.map((t) => t.formName)).size > 1) {
      message.error('Ký hàng loạt yêu cầu các hồ sơ cùng một loại đơn. Hãy lọc theo loại đơn trước.');
      return;
    }
    setBulkMode(mode);
    setBulkProgress(null);
    setBulkOpen(true);
  };

  const handleBulkConfirm = async (
    payload: Omit<SignApprovePayload, 'action'> & { action: StaffProcessMode | 'reject' },
  ) => {
    const ids = selectedTasks.map((t) => t.submissionId);
    try {
      setApproving(true);
      setBulkProgress({ done: 0, total: ids.length });
      // Fake progress while server processes sequentially
      const tick = window.setInterval(() => {
        setBulkProgress((prev) => {
          if (!prev || prev.done >= prev.total - 1) return prev;
          return { ...prev, done: prev.done + 1 };
        });
      }, 400);

      const res = await workflowsApi.bulkProcess({
        submissionIds: ids,
        action: payload.action,
        comment: payload.comment,
        signature: payload.signature,
      });
      window.clearInterval(tick);
      const data = res.data.data;
      setBulkProgress({ done: data.total, total: data.total });

      if (data.failedCount === 0) {
        message.success(res.data.message || `Đã xử lý ${data.successCount} hồ sơ`);
      } else {
        Modal.warning({
          title: 'Kết quả xử lý hàng loạt',
          content: (
            <div>
              <p>
                Thành công: <strong>{data.successCount}</strong> / {data.total}. Lỗi:{' '}
                <strong>{data.failedCount}</strong>
              </p>
              <ul className="max-h-40 overflow-y-auto pl-4">
                {data.failed.slice(0, 15).map((f) => (
                  <li key={f.submissionId}>
                    {f.submissionId}: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ),
        });
      }
      setBulkOpen(false);
      setSelectedRowKeys([]);
      fetchPending();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Xử lý hàng loạt thất bại');
    } finally {
      setApproving(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      {isAdmin && <WorkflowStepConfig />}

      {isStaffUser ? (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              allowClear
              placeholder="Lọc theo loại đơn"
              options={formOptions}
              value={formFilter}
              onChange={(value) => {
                setFormFilter(value);
                setSelectedRowKeys([]);
                updateSearchParams(filterQuery, value);
              }}
              style={{ minWidth: 220 }}
              showSearch
              optionFilterProp="label"
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Lọc mã hồ sơ, tên đơn, người nộp…"
              value={filterQuery}
              onChange={(e) => {
                const value = e.target.value;
                setFilterQuery(value);
                updateSearchParams(value, formFilter);
              }}
              style={{ maxWidth: 320 }}
            />
          </div>

          {selectedRowKeys.length > 0 && (
            <Space wrap className="p-3 rounded-md border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
              <span className="font-medium">Đã chọn {selectedTasks.length} hồ sơ</span>
              {selectedTasks.some((task) => !task.requiresSignature) && (
                <Button icon={<CheckOutlined />} type="primary" onClick={() => openBulk('approve')}>
                  Duyệt hàng loạt
                </Button>
              )}
              {selectedTasks.some((task) => task.allowSign !== false) && (
                <>
                  <Button icon={<SafetyCertificateOutlined />} onClick={() => openBulk('sign')}>
                    Ký số hàng loạt
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => openBulk('handwritten')}>
                    Ký tay hàng loạt
                  </Button>
                </>
              )}
              {selectedTasks.some((task) => task.allowReject !== false) && (
                <Button danger icon={<CloseOutlined />} onClick={() => openBulk('reject')}>
                  Từ chối hàng loạt
                </Button>
              )}
              <Button type="link" onClick={() => setSelectedRowKeys([])}>
                Bỏ chọn
              </Button>
            </Space>
          )}

          <PendingTasksTable
            tasks={filteredTasks}
            loading={loading}
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={(keys) => setSelectedRowKeys(keys)}
            onView={handleView}
            onProcess={handleProcessClick}
            onReject={handleReject}
            onReturn={handleReturn}
          />
        </>
      ) : null}

      <SignApproveModal
        open={signModalOpen}
        task={selectedTask}
        mode={processMode}
        loading={approving}
        onCancel={() => {
          setSignModalOpen(false);
          setSelectedTask(null);
        }}
        onConfirm={handleConfirmApprove}
      />

      <BulkProcessModal
        open={bulkOpen}
        tasks={selectedTasks}
        mode={bulkMode}
        loading={approving}
        progress={bulkProgress}
        onCancel={() => {
          if (approving) return;
          setBulkOpen(false);
        }}
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Cascader, Select, Space, message, InputNumber, Tag } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { DEFAULT_WORKFLOW_KEY, workflowsApi } from '../services/workflowsApi';
import type { ApproverRoleOption, FormWorkflowOption, WorkflowStep } from '../types/workflows.types';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { ROLE_LABELS, ROLES, type Role } from '@/shared/constants/roles';

const OFFICE_UNIT_ROLES = new Set<string>([
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.PHONG_ASSISTANT,
]);

const isOfficeUnitRole = (role?: string) => Boolean(role && OFFICE_UNIT_ROLES.has(role));

const stepTargetKey = (step: Pick<WorkflowStep, 'role' | 'assigneeDepartment'>) => {
  if (isOfficeUnitRole(step.role)) {
    return `${step.role}::${String(step.assigneeDepartment || '')
      .trim()
      .toLowerCase()}`;
  }
  return step.role;
};

const defaultStartRole = () => ROLES.STUDENT;

/** Gắn fromRole theo chuỗi: bước sau lấy from = role (đích) của bước trước.
 *  Bước 1: fromRole = Sinh viên (người nộp) — SV không phải bước duyệt trong danh sách.
 */
const withChainedFromRoles = (steps: WorkflowStep[], startFromRole: string): WorkflowStep[] =>
  steps.map((step, index) => ({
    ...step,
    stepOrder: index + 1,
    fromRole: index === 0 ? startFromRole || ROLES.STUDENT : steps[index - 1].role,
    assigneeDepartment: isOfficeUnitRole(step.role) ? step.assigneeDepartment || null : null,
  }));

/** Bỏ bước đích = Sinh viên (thừa / gây kẹt đơn sau khi nộp). */
const stripStudentTargetSteps = (rawSteps: WorkflowStep[]) =>
  (rawSteps || []).filter((step) => step.role && step.role !== ROLES.STUDENT);

const roleLabelOf = (roles: ApproverRoleOption[], value?: string) =>
  roles.find((r) => r.value === value)?.label ||
  (value ? ROLE_LABELS[value as Role] : undefined) ||
  value ||
  '';

const buildStepName = (
  roles: ApproverRoleOption[],
  role: string,
  assigneeDepartment?: string | null,
) => {
  const base = roleLabelOf(roles, role);
  if (assigneeDepartment) return `${base} — ${assigneeDepartment}`;
  return base;
};

export function WorkflowStepConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFormId = searchParams.get('formId');
  const requestedFormType = searchParams.get('formType');
  const appliedQueryRef = useRef(false);

  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_WORKFLOW_KEY);
  const [formOptions, setFormOptions] = useState<FormWorkflowOption[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [roleOptions, setRoleOptions] = useState<ApproverRoleOption[]>([]);
  const [selectedFormName, setSelectedFormName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFormList = useCallback(async () => {
    try {
      const res = await workflowsApi.listFormConfigs();
      setFormOptions(res.data.data);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể tải danh sách biểu mẫu');
    }
  }, []);

  const requestedTarget = useMemo(
    () =>
      formOptions.find(
        (item) =>
          item.formId === requestedFormId &&
          (!requestedFormType || item.formType === requestedFormType),
      ),
    [formOptions, requestedFormId, requestedFormType],
  );

  const applyLoadedSteps = useCallback((rawSteps: WorkflowStep[], _roles: ApproverRoleOption[]) => {
    const start = defaultStartRole();
    setSteps(withChainedFromRoles(stripStudentTargetSteps(rawSteps), start));
  }, []);

  const loadConfig = useCallback(
    async (key: string) => {
      setLoading(true);
      try {
        const rolesRes = await workflowsApi.getApproverRoles();
        const roles = rolesRes.data.data;
        setRoleOptions(roles);

        if (key === DEFAULT_WORKFLOW_KEY) {
          const configRes = await workflowsApi.getDefaultConfig();
          applyLoadedSteps(configRes.data.data.steps || [], roles);
          setSelectedFormName('');
        } else {
          const target = formOptions.find((item) => item.formId === key);
          if (!target) throw new Error('Không tìm thấy biểu mẫu');

          const configRes = await workflowsApi.getFormConfig(target.formType, target.formId);
          const data = configRes.data.data;
          applyLoadedSteps(data.workflow?.steps || [], roles);
          setSelectedFormName(data.formName);
        }
      } catch (error) {
        message.error(getErrorMessage(error) || 'Không thể tải cấu hình quy trình');
      } finally {
        setLoading(false);
      }
    },
    [formOptions, applyLoadedSteps],
  );

  useEffect(() => {
    void loadFormList();
  }, [loadFormList]);

  useEffect(() => {
    if (appliedQueryRef.current || !formOptions.length) return;
    appliedQueryRef.current = true;
    if (requestedTarget) {
      setSelectedKey(requestedTarget.formId);
    }
  }, [formOptions.length, requestedTarget]);

  const selectForm = (key: string) => {
    setSelectedKey(key);
    if (key === DEFAULT_WORKFLOW_KEY) {
      setSearchParams({}, { replace: true });
      return;
    }
    const target = formOptions.find((item) => item.formId === key);
    if (!target) return;
    setSearchParams(
      { formType: target.formType, formId: target.formId },
      { replace: true },
    );
  };

  useEffect(() => {
    if (selectedKey !== DEFAULT_WORKFLOW_KEY && formOptions.length === 0) return;
    void loadConfig(selectedKey);
  }, [selectedKey, loadConfig, formOptions.length]);

  const usedTargetKeys = useMemo(() => new Set(steps.map((step) => stepTargetKey(step))), [steps]);

  /** Cascader: nhóm → vai trò → (phòng/TT nếu cần). Rê chuột để xổ đơn vị. */
  const getToRoleCascaderOptions = (index: number): DefaultOptionType[] => {
    const current = steps[index];
    const fromRole = current?.fromRole;
    const groups = new Map<string, DefaultOptionType>();

    for (const role of roleOptions) {
      if (role.value === ROLES.STUDENT) continue;
      if (role.value === fromRole) continue;

      const isCurrentRole = current?.role === role.value;

      if (role.requiresUnit) {
        const units = role.units || [];
        const unitChildren = units
          .filter((unit) => {
            const key = `${role.value}::${unit.value.trim().toLowerCase()}`;
            const isCurrentUnit =
              isCurrentRole &&
              String(current?.assigneeDepartment || '').trim().toLowerCase() ===
                unit.value.trim().toLowerCase();
            return isCurrentUnit || !usedTargetKeys.has(key);
          })
          .map((unit) => {
            const holders = (unit.holders || [])
              .map((h) => h.fullName)
              .filter(Boolean)
              .join(', ');
            return {
              value: unit.value,
              label: holders ? `${unit.label} (${holders})` : unit.label,
              isLeaf: true,
            };
          });

        if (!unitChildren.length && !isCurrentRole) continue;

        const groupKey = role.group || 'khac';
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            value: `group:${groupKey}`,
            label: role.groupLabel || 'Khác',
            children: [],
          });
        }
        const group = groups.get(groupKey)!;
        (group.children as DefaultOptionType[]).push({
          value: role.value,
          label: role.label,
          disabled: unitChildren.length === 0,
          children:
            unitChildren.length > 0
              ? unitChildren
              : [
                  {
                    value: '__empty__',
                    label: 'Chưa có đơn vị / tài khoản trong hệ thống',
                    disabled: true,
                    isLeaf: true,
                  },
                ],
        });
        continue;
      }

      if (!isCurrentRole && usedTargetKeys.has(role.value)) continue;

      const groupKey = role.group || 'khac';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          value: `group:${groupKey}`,
          label: role.groupLabel || 'Khác',
          children: [],
        });
      }
      (groups.get(groupKey)!.children as DefaultOptionType[]).push({
        value: role.value,
        label: role.label,
        isLeaf: true,
      });
    }

    return Array.from(groups.values()).filter(
      (g) => Array.isArray(g.children) && g.children.length > 0,
    );
  };

  const cascaderValueForStep = (step: WorkflowStep): string[] | undefined => {
    if (!step.role) return undefined;
    const roleMeta = roleOptions.find((r) => r.value === step.role);
    const group = roleMeta?.group || 'khac';
    if (isOfficeUnitRole(step.role) && step.assigneeDepartment) {
      return [`group:${group}`, step.role, step.assigneeDepartment];
    }
    if (isOfficeUnitRole(step.role)) {
      return [`group:${group}`, step.role];
    }
    return [`group:${group}`, step.role];
  };

  const updateSteps = (updater: (prev: WorkflowStep[]) => WorkflowStep[]) => {
    setSteps((prev) => {
      const next = updater(prev).filter((step) => step.role !== ROLES.STUDENT);
      return withChainedFromRoles(next, defaultStartRole());
    });
  };

  const updateToRolePath = (index: number, path: (string | number | null | undefined)[]) => {
    const parts = path
      .filter((p): p is string | number => p != null)
      .map(String)
      .filter((p) => !p.startsWith('group:') && p !== '__empty__');
    if (parts.length === 0) return;

    const role = parts[0];
    const assigneeDepartment = isOfficeUnitRole(role) ? parts[1] || null : null;
    if (isOfficeUnitRole(role) && !assigneeDepartment) {
      message.warning('Vui lòng chọn phòng hoặc trung tâm cụ thể');
      return;
    }

    updateSteps((prev) =>
      prev.map((step, i) =>
        i === index
          ? {
              ...step,
              role,
              assigneeDepartment,
              stepName: buildStepName(roleOptions, role, assigneeDepartment),
            }
          : step,
      ),
    );
  };

  const updateDeadline = (index: number, deadlineDays: number | null) => {
    updateSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, deadlineDays } : step)),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    updateSteps((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const findNextAvailableTarget = (
    prevTo: string | undefined,
  ): { role: string; assigneeDepartment: string | null; label: string } | null => {
    for (const role of roleOptions) {
      if (role.value === ROLES.STUDENT) continue;
      if (role.value === prevTo) continue;
      if (role.requiresUnit) {
        for (const unit of role.units || []) {
          const key = `${role.value}::${unit.value.trim().toLowerCase()}`;
          if (usedTargetKeys.has(key)) continue;
          return {
            role: role.value,
            assigneeDepartment: unit.value,
            label: buildStepName(roleOptions, role.value, unit.value),
          };
        }
        continue;
      }
      if (usedTargetKeys.has(role.value)) continue;
      return {
        role: role.value,
        assigneeDepartment: null,
        label: role.label,
      };
    }
    return null;
  };

  const addStep = () => {
    const startFrom = defaultStartRole();
    const prevTo = steps.length > 0 ? steps[steps.length - 1].role : startFrom;
    const next = findNextAvailableTarget(prevTo);
    if (!next) {
      message.warning('Đã dùng hết các vai trò đích / đơn vị có thể cấu hình');
      return;
    }
    updateSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        stepName: next.label,
        fromRole: prevTo,
        role: next.role,
        assigneeDepartment: next.assigneeDepartment,
        isRequired: true,
        deadlineDays: null,
      },
    ]);
  };

  const removeStep = (index: number) => {
    updateSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (steps.length === 0) {
      message.warning('Quy trình cần ít nhất một bước ký/duyệt (ví dụ Trưởng khoa / Cố vấn)');
      return;
    }
    for (const step of steps) {
      if (!step.role) {
        message.warning('Mỗi bước cần chọn người ký/duyệt');
        return;
      }
      if (step.role === ROLES.STUDENT) {
        message.warning(
          'Không dùng Sinh viên làm bước duyệt — SV chỉ nộp/ký trên form, không nằm trong chuỗi quy trình',
        );
        return;
      }
      if (step.fromRole && step.fromRole === step.role) {
        if (!isOfficeUnitRole(step.role)) {
          message.warning('Vai trò nguồn và vai trò đích trong một bước phải khác nhau');
          return;
        }
      }
      if (isOfficeUnitRole(step.role) && !String(step.assigneeDepartment || '').trim()) {
        message.warning(
          `Bước «${roleLabelOf(roleOptions, step.role)}» cần chọn phòng hoặc trung tâm`,
        );
        return;
      }
    }
    const keys = steps.map((step) => stepTargetKey(step));
    if (new Set(keys).size !== keys.length) {
      message.warning('Mỗi cặp vai trò đích + đơn vị chỉ được dùng một lần trong quy trình');
      return;
    }
    setSaving(true);
    try {
      const payload = withChainedFromRoles(steps, defaultStartRole());
      if (selectedKey === DEFAULT_WORKFLOW_KEY) {
        await workflowsApi.updateDefaultConfig(payload);
        message.success('Đã lưu quy trình mặc định');
      } else {
        const target = formOptions.find((item) => item.formId === selectedKey);
        if (!target) throw new Error('Không tìm thấy biểu mẫu');
        await workflowsApi.updateFormConfig(target.formType, target.formId, payload);
        message.success(`Đã lưu quy trình cho biểu mẫu "${selectedFormName}"`);
        await loadFormList();
      }
      await loadConfig(selectedKey);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Lưu quy trình thất bại');
    } finally {
      setSaving(false);
    }
  };

  const selectOptions = [
    {
      value: DEFAULT_WORKFLOW_KEY,
      label: 'Quy trình mặc định (mẫu tham khảo — không tự gắn khi nộp đơn)',
    },
    ...formOptions.map((f) => ({
      value: f.formId,
      label: (
        <span>
          {f.formType === 'word' ? '[Word] ' : '[Manual] '}
          {f.formName}
          {f.hasCustomWorkflow ? (
            <Tag color="green" className="ml-2">
              {f.stepsCount} bước
            </Tag>
          ) : (
            <Tag color="orange" className="ml-2">
              chưa cấu hình
            </Tag>
          )}
        </span>
      ),
      searchLabel: `${f.formName} ${f.formType}`,
    })),
  ];

  const canAddStep = Boolean(findNextAvailableTarget(steps[steps.length - 1]?.role));

  return (
    <Card
      title="Cấu hình quy trình theo biểu mẫu"
      loading={loading}
      className="border border-[var(--app-border)] shadow-none rounded-xl"
      extra={
        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={addStep}
            disabled={roleOptions.length > 0 && !canAddStep}
          >
            Thêm bước
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Lưu quy trình
          </Button>
        </Space>
      }
    >
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[var(--app-text-muted)] mb-2 tracking-tight">
          Chọn biểu mẫu
        </label>
        <Select
          className="w-full max-w-xl"
          value={selectedKey}
          options={selectOptions}
          onChange={selectForm}
          placeholder="Chọn biểu mẫu để cấu hình quy trình"
          showSearch
          popupClassName="dark-select-dropdown"
          filterOption={(input, option) => {
            if (option?.value === DEFAULT_WORKFLOW_KEY) {
              return 'mặc định'.includes(input.toLowerCase());
            }
            const searchLabel = (option as { searchLabel?: string })?.searchLabel || '';
            return searchLabel.toLowerCase().includes(input.toLowerCase());
          }}
        />
      </div>

      <Space direction="vertical" size="middle" className="w-full">
        {steps.map((step, index) => (
          <div
            key={`${stepTargetKey(step)}-${index}`}
            className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 border border-[var(--app-border)] rounded-lg bg-[var(--app-bg)] min-w-0"
          >
            <span className="font-semibold text-[var(--app-text)] w-8 shrink-0">#{index + 1}</span>
            {index > 0 && (
              <>
                <span className="text-xs text-[var(--app-text-muted)] max-w-[160px] truncate" title={roleLabelOf(roleOptions, steps[index - 1]?.role)}>
                  sau {roleLabelOf(roleOptions, steps[index - 1]?.role) || 'bước trước'}
                </span>
                <ArrowRightOutlined className="text-[var(--app-text-muted)] hidden sm:inline" />
              </>
            )}
            <Cascader
              className="w-full sm:w-auto sm:min-w-[240px] sm:max-w-[360px] flex-1"
              allowClear={false}
              expandTrigger="hover"
              changeOnSelect={false}
              value={cascaderValueForStep(step)}
              options={getToRoleCascaderOptions(index)}
              placeholder="Chọn người ký bước này"
              displayRender={(labels) => labels.join(' / ')}
              onChange={(path) => updateToRolePath(index, path || [])}
            />
                <InputNumber
                  className="w-full sm:w-[140px]"
                  min={1}
                  max={3650}
                  precision={0}
                  placeholder="Số ngày"
                  addonAfter="ngày"
                  value={step.deadlineDays ?? undefined}
                  onChange={(value) => updateDeadline(index, value == null ? null : Number(value))}
                />
                <Space className="shrink-0">
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => moveStep(index, -1)}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => moveStep(index, 1)}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeStep(index)}
                    disabled={steps.length <= 1}
                  />
                </Space>
              </div>
            ))}
          </Space>
    </Card>
  );
}

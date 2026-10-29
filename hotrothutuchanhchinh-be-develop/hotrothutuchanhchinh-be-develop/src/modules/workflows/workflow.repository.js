import { Workflow, WorkflowInstance } from './workflow.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import LoaiDon from '../importForms/LoaiDon.model.js';

export const findDefaultWorkflow = () => Workflow.findOne({ isDefault: true });

export const findWorkflowByLoaiDonId = (loaiDonId) =>
  Workflow.findOne({ loaiDonId, isDefault: { $ne: true } });

export const findWorkflowById = (id) => Workflow.findById(id);

export const findLoaiDonById = (id) => LoaiDon.findById(id);

export const findAllLoaiDon = () => LoaiDon.find({ isActive: { $ne: false } }).sort({ tenDon: 1 });

export const updateLoaiDonWorkflow = (id, workflowId) =>
  LoaiDon.findByIdAndUpdate(id, { workflowId: workflowId || null }, { new: true });

export const createWorkflow = (data) => Workflow.create(data);

export const findInstancesHandledByUser = (userId) =>
  WorkflowInstance.find({ 'steps.handledBy': userId })
    .populate('generatedFileId')
    .populate('workflowId')
    .sort({ updatedAt: -1 })
    .limit(100);

export const findActiveInstances = () =>
  WorkflowInstance.find({ status: { $in: ['pending', 'in_progress', 'overdue'] } })
    .populate({
      path: 'generatedFileId',
      populate: {
        path: 'submittedBy',
        select: 'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
      },
    })
    .populate('workflowId')
    .sort({ updatedAt: -1 })
    .limit(100);

/** Đơn đang xử lý + đã hủy gần đây — dùng cho overview trưởng khoa / bộ môn */
export const findLeaderOverviewInstances = () =>
  WorkflowInstance.find({
    status: { $in: ['pending', 'in_progress', 'overdue', 'cancelled'] },
  })
    .populate({
      path: 'generatedFileId',
      populate: {
        path: 'submittedBy',
        select: 'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
      },
    })
    .populate('workflowId')
    .sort({ updatedAt: -1 })
    .limit(200);

/** Đơn thuộc đơn vị trợ lý: đang xử lý + hoàn tất + hủy (để xem/in kể cả đã ký xong) */
export const findAssistantMonitorInstances = () =>
  WorkflowInstance.find({
    status: { $in: ['pending', 'in_progress', 'overdue', 'cancelled', 'completed', 'rejected'] },
  })
    .populate({
      path: 'generatedFileId',
      populate: {
        path: 'submittedBy',
        select: 'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
      },
    })
    .populate('workflowId')
    .sort({ updatedAt: -1 })
    .limit(300);

export const findInstanceByGeneratedFile = (generatedFileId) =>
  WorkflowInstance.findOne({ generatedFileId })
    .populate('workflowId')
    .populate({
      path: 'generatedFileId',
      populate: {
        path: 'submittedBy',
        select: 'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
      },
    });

export const findInstanceById = (id) =>
  WorkflowInstance.findById(id)
    .populate('workflowId')
    .populate({
      path: 'generatedFileId',
      populate: {
        path: 'submittedBy',
        select: 'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
      },
    });

export const createInstance = (data) => WorkflowInstance.create(data);

export const updateGeneratedFileStatus = (generatedFileId, trangThai, extra = {}) =>
  GeneratedFile.findByIdAndUpdate(generatedFileId, { trangThai, ...extra }, { new: true });

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

import { AutoComplete, Card, Button, Input, Space, Modal, Form, Select, Row, Col, message, Tabs, DatePicker, Descriptions, Tag, Dropdown } from 'antd';

import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';

import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, DownOutlined, CheckCircleOutlined } from '@ant-design/icons';

import dayjs, { type Dayjs } from 'dayjs';

import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/shared/components/ui/PageHeader';

import { getApiErrorMessage } from '@/shared/utils/getApiErrorMessage';
import { ctutEmailRule } from '@/shared/utils/ctutEmail';
import { createOrgEmailDuplicateRule } from '../constants/organizationValidation';
import { loadAllOrgEmails as fetchAllOrgEmails } from '../utils/orgEmails';
import { normalizePhoneInput, optionalPhoneRule, PHONE_MAX_LENGTH } from '@/shared/utils/phoneInput';
import {
  DATE_DISPLAY_FORMAT,
  disableDateOfBirth,
  disableHistoricalDate,
  normalizeCccdInput,
  normalizeBankAccountInput,
  normalizeBirthYearInput,
  optionalCccdRule,
  optionalBankAccountRule,
  createOptionalBirthYearRule,
  BANK_ACCOUNT_MAX,
  CCCD_MAX_LENGTH,
} from '@/shared/utils/identityInput';

import { noWhitespaceOnlyRule, restrictDigitsInput } from '@/shared/utils/formInput';

import {
  ACADEMIC_YEAR_LENGTH,
  academicYearRule,
  LOP_FIELD_MAX_LENGTH,
  lopMaxLengthRule,
  lopNamePatternRule,
} from '../constants/lopValidation';
import {
  SV_CODE_MAX_LENGTH,
  SV_FIELD_MAX_LENGTH,
  svNameMaxLengthRule,
  svNamePatternRule,
} from '../constants/sinhVienValidation';

import { organizationApi } from '../services/organizationApi';

import { ImportExcelButton } from '../components/ImportExcelButton';
import { DownloadExcelTemplateButton } from '../components/DownloadExcelTemplateButton';
import { ActivityStatusTag } from '../components/ActivityStatusTag';
import {
  previewLopCode,
  previewMaHoSo,
  previewSinhVienMa,
} from '../utils/orgCodePreview';

import type { BoMon, GiangVien, Khoa, Lop, SinhVien } from '../types/organization.types';
import { refName } from '../types/organization.types';

const toDayjs = (value?: string | null) => (value ? dayjs(value) : null);

const toIsoOrNull = (value?: Dayjs | null) => (value ? value.toISOString() : null);

const SV_DATE_FIELDS = [
  'ngayVaoTruong',
  'dateOfBirth',
  'ngayCapCCCD',
  'ngayVaoDoan',
  'ngayVaoDang',
] as const;



export function LopSinhVienPage() {

  const [searchParams, setSearchParams] = useSearchParams();

  const [khoas, setKhoas] = useState<Khoa[]>([]);

  const [boMons, setBoMons] = useState<BoMon[]>([]);

  const [lops, setLops] = useState<Lop[]>([]);

  const [sinhViens, setSinhViens] = useState<SinhVien[]>([]);

  const [giangViens, setGiangViens] = useState<GiangVien[]>([]);

  /** Khoa dùng để lọc danh sách cố vấn trong modal lớp (có thể khác khoa đang quản lý lớp). */
  const [advisorKhoaId, setAdvisorKhoaId] = useState<string>();

  const [khoaId, setKhoaId] = useState<string>();

  const [boMonId, setBoMonId] = useState<string>();

  const [selectedLop, setSelectedLop] = useState<Lop | null>(null);

  const [loading, setLoading] = useState(false);

  const [lopModal, setLopModal] = useState<{ open: boolean; editing?: Lop }>({ open: false });
  const [lopDetailModal, setLopDetailModal] = useState<{ open: boolean; lop?: Lop }>({ open: false });
  const [lopDetailStudentCount, setLopDetailStudentCount] = useState<number | null>(null);
  const [lopDetailCountLoading, setLopDetailCountLoading] = useState(false);
  const [svModal, setSvModal] = useState<{ open: boolean; editing?: SinhVien }>({ open: false });
  const [svDetailModal, setSvDetailModal] = useState<{ open: boolean; sv?: SinhVien }>({ open: false });

  const [lopForm] = Form.useForm();

  const [svForm] = Form.useForm();

  const [search, setSearch] = useState(() => searchParams.get('q') || '');

  const [allLopCodes, setAllLopCodes] = useState<string[]>([]);

  const [allOrgEmails, setAllOrgEmails] = useState<string[]>([]);

  const [allSvCodes, setAllSvCodes] = useState<string[]>([]);
  const [allMaHoSo, setAllMaHoSo] = useState<string[]>([]);

  const lopAcademicYearWatch = Form.useWatch('academicYear', lopForm);

  useEffect(() => {
    if (!lopModal.open || lopModal.editing) return;
    const bm = boMons.find((b) => b._id === boMonId);
    lopForm.setFieldValue('code', previewLopCode(bm?.code, lopAcademicYearWatch, allLopCodes));
  }, [lopModal.open, lopModal.editing, boMonId, boMons, lopAcademicYearWatch, allLopCodes, lopForm]);

  useEffect(() => {
    if (!svModal.open || svModal.editing) return;
    svForm.setFieldValue('maSV', previewSinhVienMa(selectedLop?.code, allSvCodes));
    svForm.setFieldValue('maHoSo', previewMaHoSo(allMaHoSo));
  }, [svModal.open, svModal.editing, selectedLop?.code, allSvCodes, allMaHoSo, svForm]);



  useEffect(() => {
    organizationApi.khoas
      .all()
      .then((r) => {
        setKhoas(r.data.data);
        // Mặc định không lọc khoa → hiện tất cả lớp trên hệ thống
      })
      .catch((err) => message.error(getApiErrorMessage(err, 'Không tải được danh sách khoa')));
  }, []);

  useEffect(() => {
    if (!khoaId) {
      setBoMons([]);
      setBoMonId(undefined);
      return;
    }
    // Chỉ nạp danh sách bộ môn để lọc; không chọn mặc định
    organizationApi.boMons
      .list({ khoaId, limit: 200 })
      .then((r) => {
        const list = r.data.data;
        setBoMons(list);
        setBoMonId((prev) => (prev && list.some((b) => b._id === prev) ? prev : undefined));
      })
      .catch((err) => message.error(getApiErrorMessage(err, 'Không tải được danh sách bộ môn')));
  }, [khoaId]);



  const [mainTab, setMainTab] = useState<'lop' | 'sinh-vien'>('lop');

  const refId = (ref: string | { _id: string } | null | undefined) => {
    if (!ref) return undefined;
    return typeof ref === 'string' ? ref : ref._id;
  };

  const handleKhoaChange = (value?: string) => {
    setKhoaId(value);
    setBoMonId(undefined);
    setSelectedLop(null);
  };

  const handleBoMonChange = (value?: string) => {
    setBoMonId(value);
    setSelectedLop(null);
  };

  /** Chọn lớp nhanh → đồng bộ lọc khoa/bộ môn + mở tab sinh viên của lớp đó */
  const selectLopAndShowStudents = (lop: Lop | null) => {
    if (!lop) {
      setSelectedLop(null);
      return;
    }
    const nextKhoaId = refId(lop.khoaId as string | { _id: string });
    const nextBoMonId = refId(lop.boMonId as string | { _id: string });
    setSelectedLop(lop);
    if (nextKhoaId) setKhoaId(nextKhoaId);
    if (nextBoMonId) setBoMonId(nextBoMonId);
    // Hiển thị nhãn bộ môn ngay nếu API đã populate (trước khi list boMons tải xong)
    if (typeof lop.boMonId === 'object' && lop.boMonId?._id) {
      const bm = lop.boMonId as BoMon;
      setBoMons((prev) => (prev.some((b) => b._id === bm._id) ? prev : [...prev, bm]));
    }
    setMainTab('sinh-vien');
  };

  const handleSelectLopById = (lopId?: string) => {
    if (!lopId) {
      setSelectedLop(null);
      return;
    }
    const lop = lops.find((item) => item._id === lopId) ?? null;
    if (lop) selectLopAndShowStudents(lop);
    else setSelectedLop(null);
  };

  const genderLabel = (gender?: SinhVien['gender']) => {
    if (gender === 'male') return 'Nam';
    if (gender === 'female') return 'Nữ';
    if (gender === 'other') return 'Khác';
    return '—';
  };

  const textOrDash = (value?: string | null) => {
    const text = String(value ?? '').trim();
    return text || '—';
  };

  const dateOrDash = (value?: string | null) =>
    value ? dayjs(value).format(DATE_DISPLAY_FORMAT) : '—';

  const getLopDisplayName = (sv: SinhVien) => {
    if (sv.lopHoc) return sv.lopHoc;
    if (typeof sv.lopId === 'object' && sv.lopId?.name) return sv.lopId.name;
    return selectedLop?.name || '—';
  };

  /** Niên khóa 2022 → K22 */
  const academicYearToKhoaHoc = (academicYear?: string | null) => {
    const year = String(academicYear ?? '').trim();
    if (/^\d{4}$/.test(year)) return `K${year.slice(2)}`;
    return '';
  };

  const getContextKhoaName = (lop?: Lop | null) => {
    const source = lop || selectedLop;
    if (source && typeof source.khoaId === 'object' && source.khoaId?.name) {
      return source.khoaId.name;
    }
    const id =
      source && typeof source.khoaId === 'string'
        ? source.khoaId
        : khoaId;
    return khoas.find((k) => k._id === id)?.name || '';
  };

  const getContextBoMonName = (lop?: Lop | null) => {
    const source = lop || selectedLop;
    if (source && typeof source.boMonId === 'object' && source.boMonId?.name) {
      return source.boMonId.name;
    }
    const id =
      source && typeof source.boMonId === 'string'
        ? source.boMonId
        : boMonId;
    return boMons.find((b) => b._id === id)?.name || '';
  };

  const SV_STATUS_OPTIONS = [
    { value: 'Đang học', label: 'Đang học' },
    { value: 'Bảo lưu', label: 'Bảo lưu' },
    { value: 'Thôi học', label: 'Thôi học' },
    { value: 'Đã tốt nghiệp', label: 'Đã tốt nghiệp' },
    { value: 'Đình chỉ', label: 'Đình chỉ' },
  ];

  const CO_SO_OPTIONS = [
    { value: '1', label: 'Cơ sở 1' },
    { value: '2', label: 'Cơ sở 2' },
    { value: '3', label: 'Cơ sở 3' },
  ];

  const LOAI_HINH_DAO_TAO_OPTIONS = [
    { value: 'Chính quy', label: 'Chính quy' },
    { value: 'Liên thông', label: 'Liên thông' },
    { value: 'Văn bằng 2', label: 'Văn bằng 2' },
    { value: 'Vừa làm vừa học', label: 'Vừa làm vừa học' },
    { value: 'Đào tạo ngắn hạn, bồi dưỡng, cấp chứng chỉ', label: 'Đào tạo ngắn hạn, bồi dưỡng, cấp chứng chỉ' },
    { value: 'Liên kết đào tạo', label: 'Liên kết đào tạo' },
  ];

  const NOI_CAP_CCCD_DEFAULT =
    'CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI';

  const NOI_CAP_CCCD_OPTIONS = [
    {
      value: NOI_CAP_CCCD_DEFAULT,
      label: NOI_CAP_CCCD_DEFAULT,
    },
    {
      value: 'CỤC TRƯỞNG CỤC CẢNH SÁT ĐĂNG KÝ, QUẢN LÝ CƯ TRÚ VÀ DỮ LIỆU QUỐC GIA VỀ DÂN CƯ',
      label: 'CỤC TRƯỞNG CỤC CẢNH SÁT ĐĂNG KÝ, QUẢN LÝ CƯ TRÚ VÀ DỮ LIỆU QUỐC GIA VỀ DÂN CƯ',
    },
    {
      value: 'BỘ CÔNG AN',
      label: 'BỘ CÔNG AN',
    },
  ];

  const requiredMsg = (label: string) => ({ required: true, message: `Vui lòng nhập ${label}` });
  const requiredSelectMsg = (label: string) => ({ required: true, message: `Vui lòng chọn ${label}` });

  const formatCoVan = (lop: Lop) => {
    const coVan = lop.coVanId;
    if (!coVan || typeof coVan === 'string') return '—';
    if (!coVan.maGV && !coVan.fullName) return '—';
    return `${coVan.maGV || '—'} - ${coVan.fullName || '—'}`;
  };

  const openLopDetail = async (lop: Lop) => {
    setLopDetailModal({ open: true, lop });
    setLopDetailStudentCount(null);
    setLopDetailCountLoading(true);
    try {
      const res = await organizationApi.sinhViens.list({
        lopId: lop._id,
        limit: 1,
        isActive: 'all',
      });
      setLopDetailStudentCount(res.data.meta.total);
    } catch {
      setLopDetailStudentCount(null);
    } finally {
      setLopDetailCountLoading(false);
    }
  };

  const loadLops = useCallback(async () => {
    try {
      // Không chọn khoa/bộ môn → tất cả lớp; có lọc thì theo khoa/bộ môn
      const res = await organizationApi.lops.list({
        ...(khoaId ? { khoaId } : {}),
        ...(boMonId ? { boMonId } : {}),
        limit: 500,
        isActive: 'all',
      });
      const list = res.data.data;
      setLops(list);
      setSelectedLop((prev) => {
        if (prev && list.some((l) => l._id === prev._id)) return prev;
        return list[0] ?? null;
      });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách lớp'));
    }
  }, [khoaId, boMonId]);

  const loadGiangViensForAdvisorKhoa = useCallback(async () => {
    if (!advisorKhoaId) {
      setGiangViens([]);
      return;
    }
    try {
      const res = await organizationApi.giangViens.list({ khoaId: advisorKhoaId, limit: 500 });
      setGiangViens(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách cố vấn'));
    }
  }, [advisorKhoaId]);

  const loadSinhViens = useCallback(async () => {
    if (!selectedLop) { setSinhViens([]); return; }
    setLoading(true);
    try {
      const res = await organizationApi.sinhViens.list({
        lopId: selectedLop._id,
        search: search || undefined,
        limit: 200,
        isActive: 'all',
      });
      setSinhViens(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách sinh viên'));
    } finally {
      setLoading(false);
    }
  }, [selectedLop, search]);

  useEffect(() => { loadLops(); }, [loadLops]);
  useEffect(() => { void loadGiangViensForAdvisorKhoa(); }, [loadGiangViensForAdvisorKhoa]);
  useEffect(() => { loadSinhViens(); }, [loadSinhViens]);

  /** Deep-link từ thanh tìm kiếm header: ?lopId=&q= */
  useEffect(() => {
    const lopIdParam = searchParams.get('lopId');
    const qParam = searchParams.get('q');
    if (!lopIdParam && !qParam) return;

    let cancelled = false;
    (async () => {
      if (qParam) setSearch(qParam);

      if (lopIdParam) {
        try {
          let lop = lops.find((item) => item._id === lopIdParam) ?? null;
          if (!lop) {
            const res = await organizationApi.lops.list({ limit: 500, isActive: 'all' });
            if (cancelled) return;
            lop = res.data.data.find((item) => item._id === lopIdParam) ?? null;
          }
          if (lop) selectLopAndShowStudents(lop);
          else setMainTab('sinh-vien');
        } catch (err) {
          if (!cancelled) {
            message.error(getApiErrorMessage(err, 'Không mở được lớp từ tìm kiếm'));
          }
        }
      } else {
        setMainTab('sinh-vien');
      }

      if (!cancelled) {
        const next = new URLSearchParams(searchParams);
        next.delete('lopId');
        next.delete('q');
        setSearchParams(next, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadAllLopCodes = useCallback(async () => {
    const res = await organizationApi.lops.list({
      ...(khoaId ? { khoaId } : {}),
      ...(boMonId ? { boMonId } : {}),
      limit: 500,
      isActive: 'all',
    });
    setAllLopCodes(res.data.data.map((lop) => lop.code.toUpperCase()));
  }, [khoaId, boMonId]);



  const refreshOrgEmails = useCallback(async () => {

    setAllOrgEmails(await fetchAllOrgEmails());

  }, []);



  const loadAllSvCodes = useCallback(async () => {

    const res = await organizationApi.sinhViens.list({ limit: 500, isActive: 'all' });

    setAllSvCodes(res.data.data.map((sv) => sv.maSV.toUpperCase()));
    setAllMaHoSo(
      res.data.data
        .map((sv) => String(sv.maHoSo || '').toUpperCase())
        .filter(Boolean),
    );

  }, []);



  const buildSvDerivedFields = (lop?: Lop | null) => {
    const source = lop || selectedLop;
    return {
      lopHoc: source?.name || '',
      nganh: getContextKhoaName(source),
      chuyenNganh: getContextBoMonName(source),
      khoaHoc: academicYearToKhoaHoc(source?.academicYear),
    };
  };

  const openCreateSvModal = () => {
    svForm.resetFields();
    svForm.setFieldsValue({
      ...buildSvDerivedFields(selectedLop),
      gender: 'male',
      status: 'Đang học',
      loaiHinhDaoTao: 'Chính quy',
      noiCapCCCD: NOI_CAP_CCCD_DEFAULT,
      quocTich: 'Việt Nam',
    });
    void refreshOrgEmails();
    void loadAllSvCodes();
    setSvModal({ open: true });
  };

  const openEditSvModal = (sv: SinhVien) => {
    const values: Record<string, unknown> = { ...sv };
    for (const field of SV_DATE_FIELDS) {
      values[field] = toDayjs(sv[field]);
    }
    const derived = buildSvDerivedFields(selectedLop);
    if (!values.lopHoc) values.lopHoc = derived.lopHoc;
    if (!values.nganh) values.nganh = derived.nganh;
    if (!values.chuyenNganh) values.chuyenNganh = derived.chuyenNganh;
    if (!values.khoaHoc) values.khoaHoc = derived.khoaHoc;
    if (!values.gender) values.gender = 'male';
    svForm.setFieldsValue(values);
    void refreshOrgEmails();
    void loadAllSvCodes();
    setSvModal({ open: true, editing: sv });
  };

  const requireKhoaBoMon = (action: string) => {
    if (!khoaId || !boMonId) {
      message.warning(`Vui lòng chọn khoa và bộ môn trước khi ${action}`);
      return false;
    }
    return true;
  };

  const openCreateLopModal = () => {
    if (!requireKhoaBoMon('thêm lớp')) return;
    lopForm.resetFields();
    setAdvisorKhoaId(khoaId);
    void loadAllLopCodes();
    setLopModal({ open: true });
  };

  const openEditLopModal = (lop: Lop) => {
    const lopKhoaId =
      typeof lop.khoaId === 'object' && lop.khoaId
        ? lop.khoaId._id
        : typeof lop.khoaId === 'string'
          ? lop.khoaId
          : khoaId;
    const coVan = lop.coVanId;
    const coVanObj = typeof coVan === 'object' && coVan ? coVan : null;
    // Nếu cố vấn thuộc khoa khác, ưu tiên khoa của cố vấn để list đủ GV khi sửa.
    const coVanKhoaId =
      coVanObj && typeof coVanObj.khoaId === 'object' && coVanObj.khoaId
        ? coVanObj.khoaId._id
        : typeof coVanObj?.khoaId === 'string'
          ? coVanObj.khoaId
          : undefined;

    setAdvisorKhoaId(coVanKhoaId || lopKhoaId);
    lopForm.setFieldsValue({
      ...lop,
      coVanId: coVanObj?._id || (typeof coVan === 'string' ? coVan : undefined),
    });
    void loadAllLopCodes();
    setLopModal({ open: true, editing: lop });
  };



  const handleSaveLop = async (values: {
    code: string;
    name: string;
    academicYear?: string;
    coVanId?: string;
  }) => {

    if (!khoaId || !boMonId) {

      message.warning('Vui lòng chọn khoa và bộ môn trước khi thêm lớp');

      throw new Error('missing_context');

    }

    try {

      const payload = {

        ...values,

        code: String(values.code).trim().toUpperCase(),

        name: String(values.name).trim(),

        academicYear: values.academicYear ? String(values.academicYear).trim() : '',

        coVanId: values.coVanId || null,

        khoaId,

        boMonId,

      };

      if (lopModal.editing) {

        await organizationApi.lops.update(lopModal.editing._id, payload);

        message.success('Cập nhật lớp thành công');

      } else {

        await organizationApi.lops.create(payload);

        message.success('Thêm lớp thành công');

      }

      setLopModal({ open: false });

      loadLops();

    } catch (err) {

      if ((err as { errorFields?: unknown }).errorFields) {

        throw err;

      }

      if ((err as Error).message === 'missing_context') {

        throw err;

      }

      message.error(getApiErrorMessage(err, 'Không thể lưu thông tin lớp'));

      throw err;

    }

  };



  const confirmSaveLop = () =>

    lopForm

      .validateFields()

      .then(handleSaveLop)

      .catch((err) => Promise.reject(err));



  const handleLopEnterSave = (event: KeyboardEvent<HTMLInputElement>) => {

    event.preventDefault();

    void confirmSaveLop();

  };



  const handleSaveSv = async (values: Record<string, unknown>) => {
    if (!selectedLop) return;
    try {
      const derived = buildSvDerivedFields(selectedLop);
      const payload: Record<string, unknown> = {
        ...values,
        lopHoc: values.lopHoc || derived.lopHoc,
        nganh: values.nganh || derived.nganh,
        chuyenNganh: values.chuyenNganh || derived.chuyenNganh,
        khoaHoc: values.khoaHoc || derived.khoaHoc,
        lopId: selectedLop._id,
        khoaId: typeof selectedLop.khoaId === 'string' ? selectedLop.khoaId : selectedLop.khoaId?._id,
        boMonId: typeof selectedLop.boMonId === 'string' ? selectedLop.boMonId : selectedLop.boMonId?._id,
      };
      for (const key of ['_id', 'createdAt', 'updatedAt', '__v', 'userId', 'maSV', 'maHoSo']) {
        delete payload[key];
      }
      for (const field of SV_DATE_FIELDS) {
        payload[field] = toIsoOrNull(values[field] as Dayjs | null | undefined);
      }
      if (svModal.editing) {
        await organizationApi.sinhViens.update(svModal.editing._id, payload);
      } else {
        await organizationApi.sinhViens.create(payload);
      }
      message.success('Lưu thành công');
      setSvModal({ open: false });
      loadSinhViens();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) {
        throw err;
      }
      message.error(getApiErrorMessage(err, 'Không thể lưu thông tin sinh viên'));
      throw err;
    }
  };

  const SV_FIELD_LABELS: Record<string, string> = {
    maSV: 'Mã SV',
    maHoSo: 'Mã hồ sơ',
    fullName: 'Họ và tên',
    gender: 'Giới tính',
    status: 'Trạng thái',
    ngayVaoTruong: 'Ngày vào trường',
    lopHoc: 'Lớp học',
    coSo: 'Cơ sở',
    dienDaoTao: 'Diện đào tạo',
    loaiHinhDaoTao: 'Loại hình đào tạo',
    nganh: 'Ngành',
    chuyenNganh: 'Chuyên ngành',
    khoaHoc: 'Khóa học',
    nguyenQuan: 'Nguyên quán',
    quanHuyen: 'Quận/Huyện',
    phuongXa: 'Phường/Xã',
    tenTinh: 'Tên tỉnh',
    tenHuyen: 'Tên huyện',
    tenPhanHe: 'Tên phân hệ',
    truongTotNghiep: 'Trường tốt nghiệp',
    nienKhoa: 'Niên khóa',
    ghiChu: 'Ghi chú',
    dateOfBirth: 'Ngày sinh',
    danToc: 'Dân tộc',
    tonGiao: 'Tôn giáo',
    quocTich: 'Quốc tịch',
    khuVuc: 'Khu vực',
    soCCCD: 'Số CCCD',
    ngayCapCCCD: 'Ngày cấp',
    noiCapCCCD: 'Nơi cấp',
    doiTuong: 'Đối tượng',
    chinhSach: 'Chính sách',
    ngayVaoDoan: 'Ngày vào Đoàn',
    ngayVaoDang: 'Ngày vào Đảng',
    email: 'Email',
    phone: 'Điện thoại',
    diaChiLienHe: 'Địa chỉ liên hệ',
    noiSinh: 'Nơi sinh',
    diaChiThuongTru: 'Địa chỉ thường trú',
    tenNganHang: 'Tên ngân hàng',
    tenChiNhanh: 'Tên chi nhánh',
    tenChuTaiKhoan: 'Tên chủ tài khoản',
    soTaiKhoan: 'Số tài khoản',
    hoTenCha: 'Họ tên cha',
    namSinhCha: 'Năm sinh (cha)',
    ngheNgiepCha: 'Nghề nghiệp (cha)',
    sdtCha: 'SĐT cha',
    hoTenMe: 'Họ tên mẹ',
    namSinhMe: 'Năm sinh (mẹ)',
    ngheNgiepMe: 'Nghề nghiệp (mẹ)',
    sdtMe: 'SĐT mẹ',
  };

  const showSvMissingFieldsPopup = (errorFields: Array<{ name: (string | number)[]; errors: string[] }>) => {
    const labels = errorFields
      .filter((field) =>
        (field.errors || []).some((msg) => /vui lòng nhập|vui lòng chọn/i.test(String(msg))),
      )
      .map((field) => {
        const key = String(field.name?.[0] ?? '');
        return SV_FIELD_LABELS[key] || key;
      })
      .filter(Boolean);
    const uniqueLabels = [...new Set(labels)];
    if (!uniqueLabels.length) {
      // Lỗi định dạng (CCCD, SĐT…) — vẫn nhắc tổng quan
      const formatLabels = [
        ...new Set(
          errorFields
            .map((field) => SV_FIELD_LABELS[String(field.name?.[0] ?? '')] || String(field.name?.[0] ?? ''))
            .filter(Boolean),
        ),
      ];
      if (!formatLabels.length) return;
      Modal.warning({
        title: 'Thông tin chưa hợp lệ',
        content: (
          <div>
            <p className="mb-2">Vui lòng kiểm tra lại các trường:</p>
            <ul className="m-0 pl-5">
              {formatLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ),
        okText: 'Đã hiểu',
        centered: true,
        width: 480,
      });
      return;
    }

    Modal.warning({
      title: 'Thiếu thông tin bắt buộc',
      content: (
        <div>
          <p className="mb-2">Vui lòng bổ sung các trường sau trước khi lưu:</p>
          <ul className="m-0 pl-5">
            {uniqueLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ),
      okText: 'Đã hiểu',
      centered: true,
      width: 480,
    });
  };

  const confirmSaveSv = () =>
    svForm
      .validateFields()
      .then(handleSaveSv)
      .catch((err: { errorFields?: Array<{ name: (string | number)[]; errors: string[] }> }) => {
        if (err?.errorFields?.length) {
          showSvMissingFieldsPopup(err.errorFields);
        }
        return Promise.reject(err);
      });

  const handleSvEnterSave = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    void confirmSaveSv();
  };



  return (

    <div className="space-y-6">

      <PageHeader title="Quản lý Lớp & Sinh viên" subtitle="Mặc định xem tất cả lớp trên hệ thống; chọn khoa/bộ môn để lọc" />

      <div className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
        <Space wrap>

        <Select placeholder="Chọn khoa" style={{ width: 220 }} allowClear value={khoaId} onChange={handleKhoaChange}

          options={khoas.map((k) => ({ value: k._id, label: k.name }))} />

        <Select
          key={khoaId ?? 'no-khoa'}
          placeholder="Tất cả bộ môn"
          style={{ width: 220 }}
          allowClear
          value={boMonId}
          onChange={handleBoMonChange}
          disabled={!khoaId}
          options={boMons.map((b) => ({ value: b._id, label: b.name }))}
        />

      </Space>
      </div>

      <Tabs
        activeKey={mainTab}
        onChange={(key) => setMainTab(key as 'lop' | 'sinh-vien')}
        items={[
          {
            key: 'lop',
            label: 'Lớp',
            children: (
              <Card
                className="org-card-stack-header border border-[var(--app-border)] shadow-none rounded-xl"
                title={
                  <div className="flex flex-col gap-2 py-0.5">
                    <span className="whitespace-normal break-words leading-snug">Danh sách lớp</span>
                    <Space wrap size={[8, 8]}>
                      <DownloadExcelTemplateButton
                        kind="lop"
                        size="small"
                        khoaName={khoas.find((k) => k._id === khoaId)?.name}
                        boMonName={boMons.find((b) => b._id === boMonId)?.name}
                      />
                      <ImportExcelButton
                        size="small"
                        guard={() =>
                          !khoaId || !boMonId
                            ? 'Vui lòng chọn khoa và bộ môn trước khi import lớp'
                            : null
                        }
                        onImport={(file) => {
                          if (!khoaId || !boMonId) {
                            return Promise.reject(
                              new Error('Vui lòng chọn khoa và bộ môn trước khi import lớp'),
                            );
                          }
                          return organizationApi.lops.import(file, { khoaId, boMonId });
                        }}
                        onDone={loadLops}
                      />
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateLopModal}>
                        Thêm
                      </Button>
                    </Space>
                  </div>
                }
              >
                <p className="text-xs text-[var(--app-text-muted)] mb-2">
                  Mặc định hiển thị <strong>tất cả lớp trên hệ thống</strong>. Chọn khoa/bộ môn phía trên để lọc.
                  Chọn nhanh một lớp (radio) sẽ <strong>tự lọc khoa/bộ môn</strong> và mở danh sách sinh viên của lớp đó.
                  Khi <strong>Import</strong> hoặc <strong>Thêm</strong> lớp cần chọn đủ khoa và bộ môn.
                  Import cần cột <strong>Mã lớp</strong> + <strong>Tên lớp</strong>.
                </p>
                <ResponsiveTable
                  rowKey="_id"
                  size="small"
                  dataSource={lops}
                  pagination={false}
                  locale={{ emptyText: 'Chưa có lớp' }}
                  rowSelection={{
                    type: 'radio',
                    selectedRowKeys: selectedLop ? [selectedLop._id] : [],
                    onChange: (_, rows) => {
                      selectLopAndShowStudents(rows[0] ?? null);
                    },
                  }}
                  columns={[
                    { title: 'Tên lớp', dataIndex: 'name' },
                    {
                      title: 'Bộ môn',
                      key: 'boMon',
                      ellipsis: true,
                      render: (_, r: Lop) => refName(r.boMonId as BoMon),
                    },
                    {
                      title: 'Trạng thái',
                      width: 140,
                      render: (_: unknown, r: Lop) => <ActivityStatusTag active={r.isActive} />,
                    },
                    {
                      title: 'Thao tác',
                      width: 150,
                      render: (_, r) => (
                        <Dropdown.Button
                          size="small"
                          icon={<DownOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openLopDetail(r);
                          }}
                          menu={{
                            onClick: ({ domEvent }) => domEvent.stopPropagation(),
                            items: [
                              {
                                key: 'edit',
                                icon: <EditOutlined className="text-amber-500" />,
                                label: 'Sửa',
                                onClick: () => openEditLopModal(r),
                              },
                              r.isActive !== false
                                ? {
                                    key: 'deactivate',
                                    icon: <DeleteOutlined className="text-red-500" />,
                                    label: <span className="text-red-500">Ngừng hoạt động</span>,
                                    danger: true,
                                    onClick: () => {
                                      Modal.confirm({
                                        title: 'Ngừng hoạt động lớp?',
                                        content:
                                          'Lớp sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
                                        okText: 'Ngừng hoạt động',
                                        okButtonProps: { danger: true },
                                        onOk: async () => {
                                          try {
                                            await organizationApi.lops.remove(r._id);
                                            message.success('Đã chuyển sang ngừng hoạt động');
                                            loadLops();
                                          } catch (err) {
                                            message.error(
                                              getApiErrorMessage(err, 'Không thể ngừng hoạt động lớp'),
                                            );
                                            throw err;
                                          }
                                        },
                                      });
                                    },
                                  }
                                : {
                                    key: 'activate',
                                    icon: <CheckCircleOutlined className="text-emerald-500" />,
                                    label: <span className="text-emerald-600">Kích hoạt lại</span>,
                                    onClick: () => {
                                      Modal.confirm({
                                        title: 'Kích hoạt lại lớp?',
                                        content: 'Lớp sẽ trở lại trạng thái Đang hoạt động.',
                                        okText: 'Kích hoạt lại',
                                        onOk: async () => {
                                          try {
                                            await organizationApi.lops.update(r._id, { isActive: true });
                                            message.success('Đã kích hoạt lại');
                                            loadLops();
                                          } catch (err) {
                                            message.error(
                                              getApiErrorMessage(err, 'Không thể kích hoạt lại lớp'),
                                            );
                                            throw err;
                                          }
                                        },
                                      });
                                    },
                                  },
                            ],
                          }}
                        >
                          <EyeOutlined /> Chi tiết
                        </Dropdown.Button>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'sinh-vien',
            label: selectedLop ? `Sinh viên — ${selectedLop.name}` : 'Sinh viên',
            children: (
              <Card
                className="org-card-stack-header border border-[var(--app-border)] shadow-none rounded-xl"
                title={
                  <div className="flex flex-col gap-2 py-0.5">
                    <span className="whitespace-normal break-words leading-snug">
                      {selectedLop ? `Danh sách sinh viên — ${selectedLop.name}` : 'Danh sách sinh viên'}
                    </span>
                    <Space wrap size={[8, 8]}>
                      <DownloadExcelTemplateButton
                        kind="sinh-vien"
                        size="small"
                        lopName={selectedLop?.name}
                        khoaName={getContextKhoaName(selectedLop)}
                        boMonName={getContextBoMonName(selectedLop)}
                        khoaHoc={academicYearToKhoaHoc(selectedLop?.academicYear)}
                      />
                      {selectedLop ? (
                        <>
                          <ImportExcelButton
                            onImport={(file) =>
                              organizationApi.sinhViens.import(file, { lopId: selectedLop._id })
                            }
                            onDone={loadSinhViens}
                          />
                          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateSvModal}>
                            Thêm
                          </Button>
                        </>
                      ) : null}
                    </Space>
                  </div>
                }
              >
                <Space wrap className="mb-3 w-full">
                  <Select
                    placeholder="Chọn lớp"
                    style={{ width: 260 }}
                    allowClear
                    value={selectedLop?._id}
                    onChange={handleSelectLopById}
                    disabled={!khoaId}
                    options={lops.map((lop) => ({
                      value: lop._id,
                      label: `${lop.code} — ${lop.name}`,
                    }))}
                  />
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Tìm SV..."
                    style={{ width: 260 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={!selectedLop}
                  />
                </Space>

                <p className="text-xs text-[var(--app-text-muted)] mb-2">
                  Import Excel SV: <strong>bắt buộc</strong> <strong>Mã SV</strong> +{' '}
                  <strong>Họ tên</strong> + <strong>Email</strong> đuôi{' '}
                  <strong>@student.ctuet.edu.vn</strong> (không nhầm{' '}
                  <em>@student.ctut.edu.vn</em>). <strong>Mã lớp</strong> bắt buộc nếu chưa chọn
                  lớp trên UI. Các cột còn lại tùy chọn (CCCD, địa chỉ, ngân hàng, gia đình…) —
                  khớp form chi tiết và hồ sơ cá nhân portal. Tài khoản Người dùng được đồng bộ
                  tự động sau import.
                </p>

                {!selectedLop ? (
                  <p className="text-sm text-[var(--app-text-muted)] py-8 text-center">
                    Chọn lớp để xem danh sách sinh viên.
                  </p>
                ) : (
                  <ResponsiveTable
                    rowKey="_id"
                    size="small"
                    loading={loading}
                    dataSource={sinhViens}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: 'Mã SV', dataIndex: 'maSV', width: 130 },
                      { title: 'Họ tên', dataIndex: 'fullName' },
                      {
                        title: 'Lớp',
                        width: 200,
                        render: (_, r) => getLopDisplayName(r),
                      },
                      {
                        title: 'Thao tác',
                        width: 150,
                        render: (_, r) => (
                          <Dropdown.Button
                            size="small"
                            icon={<DownOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSvDetailModal({ open: true, sv: r });
                            }}
                            menu={{
                              onClick: ({ domEvent }) => domEvent.stopPropagation(),
                              items: [
                                {
                                  key: 'edit',
                                  icon: <EditOutlined className="text-amber-500" />,
                                  label: 'Sửa',
                                  onClick: () => openEditSvModal(r),
                                },
                                r.isActive !== false
                                  ? {
                                      key: 'deactivate',
                                      icon: <DeleteOutlined className="text-red-500" />,
                                      danger: true,
                                      label: <span className="text-red-500">Ngừng hoạt động</span>,
                                      onClick: () =>
                                        Modal.confirm({
                                          title: 'Ngừng hoạt động sinh viên?',
                                          content:
                                            'Sinh viên sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
                                          okText: 'Ngừng hoạt động',
                                          okButtonProps: { danger: true },
                                          onOk: async () => {
                                            try {
                                              await organizationApi.sinhViens.remove(r._id);
                                              message.success('Đã chuyển sang ngừng hoạt động');
                                              loadSinhViens();
                                            } catch (err) {
                                              message.error(
                                                getApiErrorMessage(err, 'Không thể ngừng hoạt động sinh viên'),
                                              );
                                              throw err;
                                            }
                                          },
                                        }),
                                    }
                                  : {
                                      key: 'activate',
                                      icon: <CheckCircleOutlined className="text-emerald-500" />,
                                      label: <span className="text-emerald-600">Kích hoạt lại</span>,
                                      onClick: () =>
                                        Modal.confirm({
                                          title: 'Kích hoạt lại sinh viên?',
                                          content: 'Sinh viên sẽ trở lại trạng thái Đang hoạt động.',
                                          okText: 'Kích hoạt lại',
                                          onOk: async () => {
                                            try {
                                              await organizationApi.sinhViens.update(r._id, { isActive: true });
                                              message.success('Đã kích hoạt lại');
                                              loadSinhViens();
                                            } catch (err) {
                                              message.error(
                                                getApiErrorMessage(err, 'Không thể kích hoạt lại sinh viên'),
                                              );
                                              throw err;
                                            }
                                          },
                                        }),
                                    },
                              ],
                            }}
                          >
                            <EyeOutlined /> Chi tiết
                          </Dropdown.Button>
                        ),
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />



      <Modal
        open={lopDetailModal.open}
        title={lopDetailModal.lop ? `Chi tiết lớp — ${lopDetailModal.lop.name}` : 'Chi tiết lớp'}
        onCancel={() => {
          setLopDetailModal({ open: false });
          setLopDetailStudentCount(null);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setLopDetailModal({ open: false });
              setLopDetailStudentCount(null);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        {lopDetailModal.lop && (
          <Descriptions bordered size="small" column={1} className="mt-2">
            <Descriptions.Item label="Mã lớp">{lopDetailModal.lop.code || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tên lớp">{lopDetailModal.lop.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Khoa">{refName(lopDetailModal.lop.khoaId as Khoa)}</Descriptions.Item>
            <Descriptions.Item label="Bộ môn">{refName(lopDetailModal.lop.boMonId as BoMon)}</Descriptions.Item>
            <Descriptions.Item label="Niên khóa">
              {lopDetailModal.lop.academicYear || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Cố vấn">{formatCoVan(lopDetailModal.lop)}</Descriptions.Item>
            <Descriptions.Item label="Số sinh viên">
              {lopDetailCountLoading
                ? 'Đang tải...'
                : lopDetailStudentCount == null
                  ? '—'
                  : `${lopDetailStudentCount} sinh viên`}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={lopDetailModal.lop.isActive ? 'success' : 'default'}>
                {lopDetailModal.lop.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        open={svDetailModal.open}
        title={svDetailModal.sv ? `Chi tiết sinh viên — ${svDetailModal.sv.fullName}` : 'Chi tiết sinh viên'}
        onCancel={() => setSvDetailModal({ open: false })}
        footer={[
          <Button key="close" onClick={() => setSvDetailModal({ open: false })}>
            Đóng
          </Button>,
          svDetailModal.sv ? (
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const sv = svDetailModal.sv!;
                setSvDetailModal({ open: false });
                openEditSvModal(sv);
              }}
            >
              Sửa
            </Button>
          ) : null,
        ]}
        width={920}
        destroyOnClose
      >
        {svDetailModal.sv && (() => {
          const sv = svDetailModal.sv;
          const descProps = { bordered: true, size: 'small' as const, column: { xs: 1, sm: 2, md: 3 } };
          return (
            <Tabs
              items={[
                {
                  key: 'basic',
                  label: 'Thông tin chung',
                  children: (
                    <Descriptions {...descProps} className="mt-1">
                      <Descriptions.Item label="Mã SV">{textOrDash(sv.maSV)}</Descriptions.Item>
                      <Descriptions.Item label="Mã hồ sơ">{textOrDash(sv.maHoSo)}</Descriptions.Item>
                      <Descriptions.Item label="Họ và tên">{textOrDash(sv.fullName)}</Descriptions.Item>
                      <Descriptions.Item label="Giới tính">{genderLabel(sv.gender)}</Descriptions.Item>
                      <Descriptions.Item label="Trạng thái">{textOrDash(sv.status)}</Descriptions.Item>
                      <Descriptions.Item label="Ngày vào trường">{dateOrDash(sv.ngayVaoTruong)}</Descriptions.Item>
                      <Descriptions.Item label="Lớp học">{textOrDash(sv.lopHoc || getLopDisplayName(sv))}</Descriptions.Item>
                      <Descriptions.Item label="Cơ sở">{textOrDash(sv.coSo)}</Descriptions.Item>
                      <Descriptions.Item label="Diện đào tạo">{textOrDash(sv.dienDaoTao)}</Descriptions.Item>
                      <Descriptions.Item label="Loại hình đào tạo">{textOrDash(sv.loaiHinhDaoTao)}</Descriptions.Item>
                      <Descriptions.Item label="Khoa">{textOrDash(typeof sv.khoaId === 'object' ? sv.khoaId?.name : '')}</Descriptions.Item>
                      <Descriptions.Item label="Bộ môn">{textOrDash(typeof sv.boMonId === 'object' ? sv.boMonId?.name : '')}</Descriptions.Item>
                      <Descriptions.Item label="Ngành">{textOrDash(sv.nganh)}</Descriptions.Item>
                      <Descriptions.Item label="Chuyên ngành">{textOrDash(sv.chuyenNganh)}</Descriptions.Item>
                      <Descriptions.Item label="Khóa học">{textOrDash(sv.khoaHoc)}</Descriptions.Item>
                      <Descriptions.Item label="Niên khóa">{textOrDash(sv.nienKhoa)}</Descriptions.Item>
                      <Descriptions.Item label="Tên phân hệ">{textOrDash(sv.tenPhanHe)}</Descriptions.Item>
                      <Descriptions.Item label="Trường tốt nghiệp">{textOrDash(sv.truongTotNghiep)}</Descriptions.Item>
                      <Descriptions.Item label="Nguyên quán">{textOrDash(sv.nguyenQuan)}</Descriptions.Item>
                      <Descriptions.Item label="Quận/Huyện">{textOrDash(sv.quanHuyen)}</Descriptions.Item>
                      <Descriptions.Item label="Phường/Xã">{textOrDash(sv.phuongXa)}</Descriptions.Item>
                      <Descriptions.Item label="Tên tỉnh">{textOrDash(sv.tenTinh)}</Descriptions.Item>
                      <Descriptions.Item label="Tên huyện">{textOrDash(sv.tenHuyen)}</Descriptions.Item>
                      <Descriptions.Item label="Ghi chú" span={3}>{textOrDash(sv.ghiChu)}</Descriptions.Item>
                      <Descriptions.Item label="Hoạt động">
                        <ActivityStatusTag active={sv.isActive} />
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'personal',
                  label: 'Cá nhân & CCCD',
                  children: (
                    <Descriptions {...descProps} className="mt-1">
                      <Descriptions.Item label="Ngày sinh">{dateOrDash(sv.dateOfBirth)}</Descriptions.Item>
                      <Descriptions.Item label="Dân tộc">{textOrDash(sv.danToc)}</Descriptions.Item>
                      <Descriptions.Item label="Tôn giáo">{textOrDash(sv.tonGiao)}</Descriptions.Item>
                      <Descriptions.Item label="Quốc tịch">{textOrDash(sv.quocTich)}</Descriptions.Item>
                      <Descriptions.Item label="Khu vực">{textOrDash(sv.khuVuc)}</Descriptions.Item>
                      <Descriptions.Item label="Số CCCD">{textOrDash(sv.soCCCD)}</Descriptions.Item>
                      <Descriptions.Item label="Ngày cấp">{dateOrDash(sv.ngayCapCCCD)}</Descriptions.Item>
                      <Descriptions.Item label="Nơi cấp">{textOrDash(sv.noiCapCCCD)}</Descriptions.Item>
                      <Descriptions.Item label="Đối tượng">{textOrDash(sv.doiTuong)}</Descriptions.Item>
                      <Descriptions.Item label="Chính sách">{textOrDash(sv.chinhSach)}</Descriptions.Item>
                      <Descriptions.Item label="Ngày vào Đoàn">{dateOrDash(sv.ngayVaoDoan)}</Descriptions.Item>
                      <Descriptions.Item label="Ngày vào Đảng">{dateOrDash(sv.ngayVaoDang)}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'contact',
                  label: 'Liên hệ',
                  children: (
                    <Descriptions {...descProps} className="mt-1">
                      <Descriptions.Item label="Email" span={2}>{textOrDash(sv.email)}</Descriptions.Item>
                      <Descriptions.Item label="Điện thoại">{textOrDash(sv.phone)}</Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ liên hệ" span={3}>{textOrDash(sv.diaChiLienHe)}</Descriptions.Item>
                      <Descriptions.Item label="Nơi sinh" span={3}>{textOrDash(sv.noiSinh)}</Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ thường trú" span={3}>{textOrDash(sv.diaChiThuongTru)}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'bank',
                  label: 'Ngân hàng',
                  children: (
                    <Descriptions {...descProps} className="mt-1">
                      <Descriptions.Item label="Tên ngân hàng">{textOrDash(sv.tenNganHang)}</Descriptions.Item>
                      <Descriptions.Item label="Tên chi nhánh">{textOrDash(sv.tenChiNhanh)}</Descriptions.Item>
                      <Descriptions.Item label="Tên chủ tài khoản">{textOrDash(sv.tenChuTaiKhoan)}</Descriptions.Item>
                      <Descriptions.Item label="Số tài khoản">{textOrDash(sv.soTaiKhoan)}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'family',
                  label: 'Gia đình',
                  children: (
                    <Descriptions {...descProps} className="mt-1">
                      <Descriptions.Item label="Họ tên cha">{textOrDash(sv.hoTenCha)}</Descriptions.Item>
                      <Descriptions.Item label="Họ tên mẹ">{textOrDash(sv.hoTenMe)}</Descriptions.Item>
                      <Descriptions.Item label="Năm sinh (cha)">{textOrDash(sv.namSinhCha)}</Descriptions.Item>
                      <Descriptions.Item label="Nghề nghiệp (cha)">{textOrDash(sv.ngheNgiepCha)}</Descriptions.Item>
                      <Descriptions.Item label="SĐT cha">{textOrDash(sv.sdtCha)}</Descriptions.Item>
                      <Descriptions.Item label="Năm sinh (mẹ)">{textOrDash(sv.namSinhMe)}</Descriptions.Item>
                      <Descriptions.Item label="Nghề nghiệp (mẹ)">{textOrDash(sv.ngheNgiepMe)}</Descriptions.Item>
                      <Descriptions.Item label="SĐT mẹ">{textOrDash(sv.sdtMe)}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          );
        })()}
      </Modal>

      <Modal

        open={lopModal.open}

        title={lopModal.editing ? 'Sửa lớp' : 'Thêm lớp'}

        onCancel={() => setLopModal({ open: false })}

        onOk={confirmSaveLop}

        okText="Lưu"

        keyboard={false}

      >

        <Form form={lopForm} layout="vertical">

          <Form.Item
            name="code"
            label="Mã lớp"
          >
            <Input disabled placeholder="Nhập niên khóa để xem mã" maxLength={LOP_FIELD_MAX_LENGTH} />
          </Form.Item>
          <Form.Item

            name="name"

            label="Tên lớp"

            rules={[

              { required: true, message: 'Vui lòng nhập tên lớp' },

              noWhitespaceOnlyRule,

              lopMaxLengthRule,

              lopNamePatternRule,

            ]}

          >

            <Input maxLength={LOP_FIELD_MAX_LENGTH} onPressEnter={handleLopEnterSave} />

          </Form.Item>

          <Form.Item
            name="academicYear"
            label="Niên khóa"
            rules={[noWhitespaceOnlyRule, academicYearRule]}
            normalize={(value) => restrictDigitsInput(value, ACADEMIC_YEAR_LENGTH)}
          >
            <Input
              placeholder="VD: 2022"
              maxLength={ACADEMIC_YEAR_LENGTH}
              inputMode="numeric"
              onPressEnter={handleLopEnterSave}
            />
          </Form.Item>

          <Form.Item label="Lọc khoa">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khoa để xem giảng viên"
              value={advisorKhoaId}
              onChange={(value?: string) => {
                setAdvisorKhoaId(value);
                lopForm.setFieldValue('coVanId', undefined);
              }}
              allowClear
              options={khoas.map((k) => ({ value: k._id, label: `${k.code} — ${k.name}` }))}
            />
          </Form.Item>

          <Form.Item name="coVanId" label="Cố vấn học tập">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={
                advisorKhoaId
                  ? 'Chọn giảng viên (MGV - Họ tên)'
                  : 'Chọn khoa phía trên trước'
              }
              disabled={!advisorKhoaId}
              options={giangViens.map((gv) => ({
                value: gv._id,
                label: `${gv.maGV} - ${gv.fullName}`,
              }))}
              notFoundContent={advisorKhoaId ? 'Khoa này chưa có giảng viên' : null}
            />
          </Form.Item>

        </Form>

      </Modal>

      <Modal
        open={svModal.open}
        title={svModal.editing ? 'Sửa sinh viên' : 'Thêm sinh viên'}
        onCancel={() => setSvModal({ open: false })}
        onOk={confirmSaveSv}
        okText="Lưu"
        keyboard={false}
        width={920}
        destroyOnClose
      >
        <Form
          form={svForm}
          layout="vertical"
          initialValues={{
            quocTich: 'Việt Nam',
            gender: 'male',
            status: 'Đang học',
            loaiHinhDaoTao: 'Chính quy',
            noiCapCCCD: NOI_CAP_CCCD_DEFAULT,
          }}
        >
          <Tabs
            items={[
              {
                key: 'basic',
                label: 'Thông tin chung',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item name="maSV" label="Mã SV" rules={[requiredMsg('mã SV')]}>
                        <Input disabled placeholder="Chọn lớp để xem mã" maxLength={SV_CODE_MAX_LENGTH} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="maHoSo" label="Mã hồ sơ" rules={[requiredMsg('mã hồ sơ')]}>
                        <Input disabled placeholder="Tự sinh theo năm hiện tại" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="fullName"
                        label="Họ và tên"
                        rules={[
                          requiredMsg('họ tên'),
                          noWhitespaceOnlyRule,
                          svNameMaxLengthRule,
                          svNamePatternRule,
                        ]}
                      >
                        <Input maxLength={SV_FIELD_MAX_LENGTH} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="gender" label="Giới tính" rules={[requiredSelectMsg('giới tính')]}>
                        <Select
                          options={[
                            { value: 'male', label: 'Nam' },
                            { value: 'female', label: 'Nữ' },
                            { value: 'other', label: 'Khác' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="status" label="Trạng thái" rules={[requiredSelectMsg('trạng thái')]}>
                        <Select options={SV_STATUS_OPTIONS} placeholder="Chọn trạng thái" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="ngayVaoTruong" label="Ngày vào trường">
                        <DatePicker
                          className="w-full"
                          format={DATE_DISPLAY_FORMAT}
                          disabledDate={disableHistoricalDate}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="lopHoc" label="Lớp học" rules={[requiredMsg('lớp học')]}>
                        <Input disabled maxLength={100} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="coSo" label="Cơ sở">
                        <Select options={CO_SO_OPTIONS} placeholder="Chọn cơ sở" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="dienDaoTao" label="Diện đào tạo">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="loaiHinhDaoTao"
                        label="Loại hình đào tạo"
                        rules={[requiredSelectMsg('loại hình đào tạo')]}
                      >
                        <Select
                          options={LOAI_HINH_DAO_TAO_OPTIONS}
                          placeholder="Chọn loại hình đào tạo"
                          showSearch
                          optionFilterProp="label"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Khoa">
                        <Input disabled value={getContextKhoaName(selectedLop)} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Bộ môn">
                        <Input disabled value={getContextBoMonName(selectedLop)} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="nganh" label="Ngành" rules={[requiredMsg('ngành')]}>
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="chuyenNganh" label="Chuyên ngành" rules={[requiredMsg('chuyên ngành')]}>
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="khoaHoc" label="Khóa học" rules={[requiredMsg('khóa học')]}>
                        <Input disabled maxLength={50} placeholder="Theo niên khóa lớp" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="nienKhoa" label="Niên khóa">
                        <Input maxLength={50} placeholder="VD: 2019 - 2023" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="tenPhanHe" label="Tên phân hệ">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="truongTotNghiep" label="Trường tốt nghiệp">
                        <Input maxLength={255} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="nguyenQuan" label="Nguyên quán">
                        <Input maxLength={255} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="quanHuyen" label="Quận/Huyện">
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="phuongXa" label="Phường/Xã">
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="tenTinh" label="Tên tỉnh">
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="tenHuyen" label="Tên huyện">
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="ghiChu" label="Ghi chú">
                        <Input.TextArea rows={2} maxLength={500} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'personal',
                label: 'Cá nhân & CCCD',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="dateOfBirth"
                        label="Ngày sinh"
                        rules={[requiredSelectMsg('ngày sinh')]}
                      >
                        <DatePicker
                          className="w-full"
                          format={DATE_DISPLAY_FORMAT}
                          disabledDate={disableDateOfBirth}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="danToc" label="Dân tộc">
                        <Input maxLength={50} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="tonGiao" label="Tôn giáo">
                        <Input maxLength={50} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="quocTich" label="Quốc tịch" rules={[requiredMsg('quốc tịch')]}>
                        <Input maxLength={50} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="khuVuc" label="Khu vực">
                        <Input maxLength={50} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="soCCCD"
                        label="Số CCCD"
                        normalize={normalizeCccdInput}
                        rules={[optionalCccdRule]}
                      >
                        <Input
                          maxLength={CCCD_MAX_LENGTH}
                          inputMode="numeric"
                          placeholder="9 hoặc 12 số"
                          onPressEnter={handleSvEnterSave}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="ngayCapCCCD" label="Ngày cấp">
                        <DatePicker
                          className="w-full"
                          format={DATE_DISPLAY_FORMAT}
                          disabledDate={disableHistoricalDate}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="noiCapCCCD" label="Nơi cấp">
                        <AutoComplete
                          options={NOI_CAP_CCCD_OPTIONS}
                          placeholder="Chọn hoặc nhập nơi cấp"
                          filterOption={(input, option) =>
                            String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                          }
                        >
                          <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                        </AutoComplete>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="doiTuong" label="Đối tượng">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="chinhSach" label="Chính sách">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="ngayVaoDoan" label="Ngày vào Đoàn">
                        <DatePicker
                          className="w-full"
                          format={DATE_DISPLAY_FORMAT}
                          disabledDate={disableHistoricalDate}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="ngayVaoDang" label="Ngày vào Đảng">
                        <DatePicker
                          className="w-full"
                          format={DATE_DISPLAY_FORMAT}
                          disabledDate={disableHistoricalDate}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'contact',
                label: 'Liên hệ',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                          { required: true, message: 'Vui lòng nhập Email' },
                          noWhitespaceOnlyRule,
                          { type: 'email', message: 'Email không đúng định dạng' },
                          ctutEmailRule,
                          createOrgEmailDuplicateRule(allOrgEmails, svModal.editing?.email),
                        ]}
                      >
                        <Input placeholder="vidu@student.ctuet.edu.vn" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="phone"
                        label="Điện thoại"
                        normalize={normalizePhoneInput}
                        rules={[optionalPhoneRule]}
                      >
                        <Input placeholder="0901234567" maxLength={PHONE_MAX_LENGTH} inputMode="numeric" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="diaChiLienHe"
                        label="Địa chỉ liên hệ"
                      >
                        <Input.TextArea rows={2} maxLength={255} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="noiSinh" label="Nơi sinh">
                        <Input.TextArea rows={2} maxLength={255} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="diaChiThuongTru"
                        label="Địa chỉ thường trú"
                      >
                        <Input.TextArea rows={2} maxLength={255} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'bank',
                label: 'Ngân hàng',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="tenNganHang"
                        label="Tên ngân hàng"
                      >
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="tenChiNhanh"
                        label="Tên chi nhánh"
                      >
                        <Input maxLength={150} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="tenChuTaiKhoan"
                        label="Tên chủ tài khoản"
                      >
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="soTaiKhoan"
                        label="Số tài khoản"
                        normalize={normalizeBankAccountInput}
                        rules={[optionalBankAccountRule]}
                      >
                        <Input
                          maxLength={BANK_ACCOUNT_MAX}
                          inputMode="numeric"
                          placeholder="6–20 chữ số"
                          onPressEnter={handleSvEnterSave}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'family',
                label: 'Gia đình',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="hoTenCha" label="Họ tên cha">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="hoTenMe" label="Họ tên mẹ">
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="namSinhCha"
                        label="Năm sinh (cha)"
                        normalize={normalizeBirthYearInput}
                        rules={[createOptionalBirthYearRule('Năm sinh (cha)')]}
                      >
                        <Input maxLength={4} inputMode="numeric" placeholder="VD: 1975" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="ngheNgiepCha"
                        label="Nghề nghiệp (cha)"
                      >
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="sdtCha"
                        label="SĐT cha"
                        normalize={normalizePhoneInput}
                        rules={[optionalPhoneRule]}
                      >
                        <Input maxLength={PHONE_MAX_LENGTH} inputMode="numeric" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="namSinhMe"
                        label="Năm sinh (mẹ)"
                        normalize={normalizeBirthYearInput}
                        rules={[createOptionalBirthYearRule('Năm sinh (mẹ)')]}
                      >
                        <Input maxLength={4} inputMode="numeric" placeholder="VD: 1978" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="ngheNgiepMe"
                        label="Nghề nghiệp (mẹ)"
                      >
                        <Input maxLength={100} onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="sdtMe"
                        label="SĐT mẹ"
                        normalize={normalizePhoneInput}
                        rules={[optionalPhoneRule]}
                      >
                        <Input maxLength={PHONE_MAX_LENGTH} inputMode="numeric" onPressEnter={handleSvEnterSave} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

    </div>

  );

}



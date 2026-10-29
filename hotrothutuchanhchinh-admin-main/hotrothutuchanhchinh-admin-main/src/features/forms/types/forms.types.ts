export interface ImportedFormDetail {
  _id: string;
  moTa: string;
  placeHolder: string;
}

export interface ImportedForm {
  _id: string;
  tenDon: string;
  templateFile: string;
  sourceType?: string;
  originalFileName?: string;
  description?: string;
  workflowId?: string;
  chiTiet?: ImportedFormDetail[];
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ExportedDocumentResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface GeneratedFileRow {
  _id: string;
  tenDon: string;
  tenNguoiGui: string;
  trangThai: string;
  duongDanFile?: string;
  sourceType?: string;
  createdAt: string;
}

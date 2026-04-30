import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

interface Props {
  onFile: (file: File) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export default function PdfUploader({ onFile, onRemove, disabled }: Props) {
  return (
    <Upload
      accept=".pdf"
      maxCount={1}
      beforeUpload={(file) => { onFile(file); return false; }}
      onRemove={onRemove}
      disabled={disabled}
    >
      <Button icon={<UploadOutlined />} disabled={disabled}>
        选择 PDF 文件
      </Button>
    </Upload>
  );
}

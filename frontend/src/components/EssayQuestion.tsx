import { Input, Typography } from 'antd';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function EssayQuestion({ value, onChange, disabled, placeholder = '输入你的解答...' }: Props) {
  return (
    <TextArea
      rows={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={{ marginTop: 16 }}
    />
  );
}

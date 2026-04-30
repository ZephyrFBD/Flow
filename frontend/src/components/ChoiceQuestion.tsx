import { Radio } from 'antd';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ChoiceQuestion({ options, value, onChange, disabled }: Props) {
  return (
    <Radio.Group
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}
    >
      {options.map((opt) => (
        <Radio key={opt} value={opt} style={{ padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {opt}
        </Radio>
      ))}
    </Radio.Group>
  );
}

import type { DividendType } from "../../types/fund";

interface ActionTypePickerProps {
  value: DividendType;
  options: Array<{ value: DividendType; label: string }>;
  disabled: boolean;
  onChange: (value: DividendType) => void;
}

export function ActionTypePicker({ value, options, disabled, onChange }: ActionTypePickerProps) {
  return (
    <fieldset className="action-type-picker" disabled={disabled}>
      <legend>记录类型</legend>
      <div className="action-type-options">
        {options.map((option) => (
          <label className={option.value === value ? "active" : ""} key={option.value}>
            <input
              type="radio"
              name="dividendActionType"
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="action-type-indicator" aria-hidden="true" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

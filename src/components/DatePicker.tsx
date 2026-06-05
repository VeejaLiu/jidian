import ReactDatePicker from "react-datepicker";
import { parseISODate, toISODate } from "../utils/date";

interface DatePickerProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function DatePicker({ value, disabled, onChange }: DatePickerProps) {
  return (
    <ReactDatePicker
      selected={parseISODate(value)}
      onChange={(date) => {
        if (date) onChange(toISODate(date));
      }}
      className="date-input"
      calendarClassName="app-datepicker-calendar"
      popperClassName="app-datepicker-popper"
      dateFormat="yyyy-MM-dd"
      disabled={disabled}
      locale="zh-CN"
      showPopperArrow={false}
      todayButton="今天"
      shouldCloseOnSelect
    />
  );
}

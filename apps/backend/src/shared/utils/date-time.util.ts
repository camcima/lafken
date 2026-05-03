import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

class DateTimeUtility {
  constructor() {
    dayjs.extend(customParseFormat);
  }

  parseStrAsDate(input: { dateToParse: string; format?: string }): Date {
    return dayjs(input.dateToParse, input.format).toDate();
  }

  formatDateAs(input: { date: Date; format: string }): string {
    return dayjs(input.date).format(input.format);
  }
}

export const dateTimeUtility = new DateTimeUtility();

import { Type } from '@mikro-orm/core'

export class UnixTimestampType extends Type<Date | null, number | null> {
  convertToDatabaseValue(value: Date | null | undefined): number | null {
    if (value == null) return null
    return Math.floor(value.getTime() / 1000)
  }

  convertToJSValue(value: number | null | undefined): Date | null {
    if (value == null) return null
    return new Date(value * 1000)
  }

  getColumnType(): string {
    return 'integer'
  }

  compareAsType(): string {
    return 'number'
  }
}

import { Type } from '@mikro-orm/core'

export class UnixTimestampType extends Type<Date | null, number | null> {
  override convertToDatabaseValue(value: Date | number | null | undefined): number | null {
    if (value == null) return null
    if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : value
    return Math.floor(value.getTime() / 1000)
  }

  override convertToJSValue(value: number | null | undefined): Date | null {
    if (value == null) return null
    return new Date(value * 1000)
  }

  override getColumnType(): string {
    return 'integer'
  }

  override compareAsType(): string {
    return 'date'
  }
}

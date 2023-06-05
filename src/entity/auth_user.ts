import { Entity, Index, PrimaryGeneratedColumn, Column } from "typeorm"

// TODO: deprecated
@Entity()
@Index(['email'], { unique: true })
export class AuthUser {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ length: 128, nullable: false })
  email?: string

  @Column({ length: 128, nullable: false })
  password?: string

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

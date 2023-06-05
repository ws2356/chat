import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm"

@Entity()
@Index(['authId', 'authType'], { unique: true })
export class AuthSignupVerify {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'auth_id', length: 128, nullable: false })
  authId!: string

  // 1: email, 2: wechat, 3: phone
  @Column({ name: 'auth_type', nullable: false, enum: [1, 2, 3] })
  authType!: number

  // 1: ok, 2: pending
  @Column({ name: 'auth_status', nullable: false, enum: [1, 2] })
  authStatus!: number

  @Column({ length: 6, nullable: false })
  code!: string

   @Column({ name: 'device_id', length: 64, nullable: true })
  deviceId?: string

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

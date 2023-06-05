import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm"
import { AuthIdentity } from './auth_identity'

@Entity()
@Index(['authId', 'authType'], { unique: true })
export class AuthSignup {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(type => AuthIdentity)
  @JoinColumn({ name: 'identity_id' })
  identity?: AuthIdentity

  @Column({ name: 'auth_id', length: 128, nullable: false })
  authId!: string

  // 1: email, 2: phone, 3: mlgb clientId
  @Column({ name: 'auth_type', nullable: false, enum: [1, 2, 3] })
  authType!: number

  @Column({ length: 128, nullable: false })
  credential!: string

  @Column({ name: 'device_id', length: 64, nullable: true })
  deviceId?: string

  @Column({ length: 64  })
  source?: string

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

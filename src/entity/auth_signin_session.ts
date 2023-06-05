import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm"
import { AuthSignup } from './auth_signup'

@Entity()
@Index(['token'], { unique: true })
export class AuthSigninSession {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(type => AuthSignup)
  @JoinColumn({ name: 'signup_id' })
  signup?: AuthSignup

  @Column({ length: 64, nullable: false })
  token!: string

  @Column({ name: 'device_id', length: 64, nullable: true })
  deviceId!: string

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date
}

import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm"
import { AuthUser } from './auth_user'

@Entity()
@Index(['token'], { unique: true })
export class AuthSession {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ length: 36, nullable: false })
  token?: string

  // TODO: change this to AuthSignup
  // TODO: also, migrate by: create AuthSignup from existing AuthUser
  @ManyToOne(type => AuthUser)
  @JoinColumn({ name: 'user_id' })
  user?: AuthUser

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

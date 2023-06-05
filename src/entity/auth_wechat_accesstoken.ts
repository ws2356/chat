import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from "typeorm"

@Entity()
@Index(['clientId'], { unique: true })
export class AuthWechatAccesstoken {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ name: 'client_id', length: 64, nullable: false })
  clientId!: string

  @Column({ length: 512, nullable: false })
  token!: string

  @Column({ name: 'expires_at', nullable: false })
  expiresAt!: Date

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

import { Entity, Index, PrimaryGeneratedColumn, OneToOne, OneToMany, JoinColumn, Column } from "typeorm"

@Entity()
@Index(['authId', 'authType', 'createTime'], { unique: true })
export class ChatSubscription {
  @PrimaryGeneratedColumn()
  id!: number

  // 3: mlgb clientId
  @Column({ name: 'auth_type', nullable: false, enum: [3] })
  authType!: number

  // wechat user openId
  @Column({ name: 'auth_id', length: 128, nullable: false })
  authId!: string

  @Column({ name: 'to_user_name', length: 32, nullable: false })
  toUserName!: string

  @Column({ name: 'create_time', nullable: false })
  createTime!: Date

  @Column({ name: 'event', length: 16, nullable: false })
  event!: 'subscribe' | 'unsubscribe'
}

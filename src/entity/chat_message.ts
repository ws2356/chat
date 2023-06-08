import { Entity, Index, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column } from "typeorm"
import { ChatReply } from "./chat_reply"

@Entity()
@Index(['authId', 'authType', 'msgId'], { unique: true })
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number

  // 3: mlgb clientId
  @Column({ name: 'auth_type', nullable: false, enum: [3] })
  authType!: number

  // wechat user openId
  @Column({ name: 'auth_id', length: 128, nullable: false })
  authId!: string

  @Column({ name: 'msg_id', length: 128, nullable: false })
  msgId!: string

  @Column({ name: 'msg_type', length: 32, nullable: false })
  msgType!: string

  @Column({ nullable: false })
  content!: string

  @Column({ name: 'to_user_name', length: 32, nullable: false })
  toUserName!: string

  @Column({ name: 'create_time', nullable: false })
  createTime?: Date

  @OneToOne(() => ChatReply, { eager: true, cascade: true })
  @JoinColumn({ name: 'reply_id' })
  reply!: ChatReply
}

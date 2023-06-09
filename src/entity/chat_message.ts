import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, Column } from "typeorm"
import { ChatReply } from "./chat_reply"
import { ChatThread } from "./chat_thread"

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

  @OneToMany(() => ChatReply, reply => reply.chatMessage, { eager: true })
  replies!: ChatReply[]

  @ManyToOne(() => ChatThread, (thread) => thread.messages, { eager: true })
  @JoinColumn({ name: 'chat_thread_id' })
  chatThread!: ChatThread

  @Column({ name: 'media_id', length: 128, nullable: true })
  mediaId!: string

  @Column({ name: 'format', length: 16, nullable: true })
  format!: string

  // default 1
  @Column()
  tries!: number
}

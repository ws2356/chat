import { Entity, Index, PrimaryGeneratedColumn, OneToOne, OneToMany, JoinColumn, Column } from "typeorm"
import { ChatMessage } from "./chat_message"

@Entity()
@Index(['authId', 'authType'], { unique: true })
export class ChatThread {
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

  @Column({ nullable: false })
  completed!: boolean

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date

  @OneToMany(() => ChatMessage, msg => msg.chatThread)
  messages!: ChatMessage[]
}

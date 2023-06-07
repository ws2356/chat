import { Entity, Index, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column } from "typeorm"
import { ChatMessage } from "./chat_message"

@Entity()
export class ChatReply {
  @PrimaryGeneratedColumn()
  id!: number

  @OneToOne(() => ChatMessage, (msg) => msg.reply)
  chatMessage!: ChatMessage

  @Column({ nullable: false })
  reply?: string

  // 1: loaded, 2: pending, 3: fail
  @Column({ name: 'load_status', nullable: false, default: 2 })
  loadStatus!: number

  @Column({ nullable: false, default: false })
  replied!: boolean

  @Column({ name: 'created_at', nullable: false })
  createdAt!: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt!: Date
}

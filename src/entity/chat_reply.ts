import { Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, ManyToMany } from "typeorm"
import { ChatMessage } from "./chat_message"

@Entity()
export class ChatReply {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => ChatMessage, (msg) => msg.replies)
  @JoinColumn({ name: 'chat_message_id' })
  chatMessage!: ChatMessage

  @Column({ nullable: true })
  reply?: string

  // 1: loaded, 2: pending, 3: fail, 4: not started
  @Column({ name: 'load_status', nullable: false, default: 4 })
  loadStatus!: number

  @Column({ nullable: false, default: false })
  replied!: boolean

  @Column({ name: 'created_at', nullable: false })
  createdAt!: Date

  @Column({ name: 'loaded_at', nullable: true })
  loadedAt?: Date
}

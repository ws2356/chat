import { Entity, Index, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class AuthIdentity {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  username?: string

  // 1: male, 2: female, 3: other
  @Column({ enum: [1, 2, 3] })
  gender?: number

  // SINGLE
  // MARRIED
  // DIVORCED
  // SEPARATED
  // WIDOWED
  // OTHER
  @Column({ name: 'marital_status', enum: [1, 2, 3, 4, 5, 6] })
  maritalStatus?: number

  @Column()
  birthday?: Date

  @Column({ name: 'created_at', nullable: false })
  createdAt?: Date

  @Column({ name: 'updated_at', nullable: false })
  updatedAt?: Date
}

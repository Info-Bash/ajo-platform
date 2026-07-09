import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendDirectMessageDto {
  @ApiProperty({ example: "Hey! Saw you're also in the Lagos Hustlers circle 👋" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class GetDirectMessagesDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 30, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 30;
}

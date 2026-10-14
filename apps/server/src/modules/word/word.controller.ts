import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WordService } from './word.service';
import {
  BatchReviewDto,
  CreateWordBookDto,
  CreateWordDto,
  ImportWordsDto,
  UpdateWordDto,
  WordQueryDto,
  WordReviewDto,
} from './dto/word.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';

@ApiTags('单词本')
@Controller('words')
@AuthScope('user')
export class WordController {
  constructor(private readonly word: WordService) {}

  /* ------------------------- 单词本 ------------------------- */

  @Get('books')
  @ApiOperation({ summary: '我的单词本' })
  books(@CurrentUser('sub') userId: number) {
    return this.word.listBooks(userId);
  }

  @Post('books')
  @ApiOperation({ summary: '新建单词本' })
  createBook(@CurrentUser('sub') userId: number, @Body() dto: CreateWordBookDto) {
    return this.word.createBook(userId, dto);
  }

  @Put('books/:id')
  @ApiOperation({ summary: '编辑单词本' })
  updateBook(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWordBookDto,
  ) {
    return this.word.updateBook(userId, id, dto);
  }

  @Delete('books/:id')
  @ApiOperation({ summary: '删除单词本' })
  removeBook(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.word.removeBook(userId, id);
  }

  /* ------------------------- 单词 ------------------------- */

  @Get()
  @ApiOperation({ summary: '单词列表' })
  list(@CurrentUser('sub') userId: number, @Query() query: WordQueryDto) {
    return this.word.listWords(userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: '单词统计' })
  stats(@CurrentUser('sub') userId: number) {
    return this.word.stats(userId);
  }

  @Get('review/today')
  @ApiOperation({ summary: '今日待复习队列' })
  todayQueue(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    return this.word.todayQueue(userId, limit ? Number(limit) : 20);
  }

  @Post()
  @ApiOperation({ summary: '新增单词' })
  create(@CurrentUser('sub') userId: number, @Body() dto: CreateWordDto) {
    return this.word.createWord(userId, dto);
  }

  @Post('import')
  @ApiOperation({ summary: '批量导入单词' })
  import(@CurrentUser('sub') userId: number, @Body() dto: ImportWordsDto) {
    return this.word.importWords(userId, dto);
  }

  @Post('review')
  @ApiOperation({ summary: '提交一次复习结果' })
  review(@CurrentUser('sub') userId: number, @Body() dto: WordReviewDto) {
    return this.word.review(userId, dto);
  }

  @Post('review/batch')
  @ApiOperation({ summary: '批量提交复习结果' })
  batchReview(@CurrentUser('sub') userId: number, @Body() dto: BatchReviewDto) {
    return this.word.batchReview(userId, dto);
  }

  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除单词' })
  batchDelete(@CurrentUser('sub') userId: number, @Body('ids') ids: number[]) {
    return this.word.batchRemoveWords(userId, ids ?? []);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑单词' })
  update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWordDto,
  ) {
    return this.word.updateWord(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除单词' })
  remove(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.word.removeWord(userId, id);
  }
}

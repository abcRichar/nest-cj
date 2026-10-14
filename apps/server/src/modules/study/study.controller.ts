import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudyService } from './study.service';
import { ReportProgressDto, StudyQueryDto } from './dto/study.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';

@ApiTags('学习进度')
@Controller('study')
@AuthScope('user')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Post('report')
  @ApiOperation({ summary: '上报学习进度' })
  report(@CurrentUser('sub') userId: number, @Body() dto: ReportProgressDto) {
    return this.study.report(userId, dto);
  }

  @Get('overview')
  @ApiOperation({ summary: '学习总览' })
  overview(@CurrentUser('sub') userId: number) {
    return this.study.overview(userId);
  }

  @Get('records')
  @ApiOperation({ summary: '学习记录' })
  records(@CurrentUser('sub') userId: number, @Query() query: StudyQueryDto) {
    return this.study.records(userId, query);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: '单课程学习进度' })
  courseProgress(
    @CurrentUser('sub') userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.study.courseProgress(userId, courseId);
  }
}

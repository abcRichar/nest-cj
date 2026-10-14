import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CourseQueryDto } from './dto/course.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';

@ApiTags('课程')
@Controller('courses')
@AuthScope('user')
export class CourseController {
  constructor(private readonly course: CourseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '课程列表' })
  list(@Query() query: CourseQueryDto) {
    return this.course.listPublic(query);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: '课程分类' })
  categories() {
    return this.course.categories();
  }

  @Get('mine')
  @ApiOperation({ summary: '我的课程' })
  mine(@CurrentUser('sub') userId: number) {
    return this.course.myCourses(userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '课程详情（含章节课时）' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser('sub') userId?: number) {
    return this.course.detail(id, userId);
  }
}

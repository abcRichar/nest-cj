import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseService } from './course.service';
import {
  CategoryDto,
  CourseQueryDto,
  CreateChapterDto,
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
} from './dto/course.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { PublishStatus, UserRole } from '@elp/shared';

@ApiTags('管理端-课程')
@Controller('admin/courses')
@AuthScope('admin')
@Roles(UserRole.ADMIN)
export class AdminCourseController {
  constructor(private readonly course: CourseService) {}

  @Get()
  @ApiOperation({ summary: '课程列表（含草稿/下架）' })
  list(@Query() query: CourseQueryDto) {
    return this.course.adminList(query);
  }

  @Post()
  @ApiOperation({ summary: '新建课程' })
  create(@Body() dto: CreateCourseDto) {
    return this.course.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑课程' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
    return this.course.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '上下架' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: PublishStatus,
  ) {
    return this.course.changeStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除课程（有订单则自动下架）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.course.remove(id);
  }

  /* ------------------------- 章节 ------------------------- */

  @Post(':courseId/chapters')
  @ApiOperation({ summary: '新增章节' })
  addChapter(@Param('courseId', ParseIntPipe) courseId: number, @Body() dto: CreateChapterDto) {
    return this.course.addChapter(courseId, dto);
  }

  @Put('chapters/:chapterId')
  @ApiOperation({ summary: '编辑章节' })
  updateChapter(@Param('chapterId', ParseIntPipe) chapterId: number, @Body() dto: CreateChapterDto) {
    return this.course.updateChapter(chapterId, dto);
  }

  @Delete('chapters/:chapterId')
  @ApiOperation({ summary: '删除章节' })
  removeChapter(@Param('chapterId', ParseIntPipe) chapterId: number) {
    return this.course.removeChapter(chapterId);
  }

  /* ------------------------- 课时 ------------------------- */

  @Post(':courseId/chapters/:chapterId/lessons')
  @ApiOperation({ summary: '新增课时' })
  addLesson(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Body() dto: CreateLessonDto,
  ) {
    return this.course.addLesson(courseId, chapterId, dto);
  }

  @Put('lessons/:lessonId')
  @ApiOperation({ summary: '编辑课时' })
  updateLesson(@Param('lessonId', ParseIntPipe) lessonId: number, @Body() dto: CreateLessonDto) {
    return this.course.updateLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @ApiOperation({ summary: '删除课时' })
  removeLesson(@Param('lessonId', ParseIntPipe) lessonId: number) {
    return this.course.removeLesson(lessonId);
  }

  /* ------------------------- 分类 ------------------------- */

  @Post('categories')
  @ApiOperation({ summary: '新增分类' })
  createCategory(@Body() dto: CategoryDto) {
    return this.course.createCategory(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: '编辑分类' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.course.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除分类' })
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.course.removeCategory(id);
  }
}

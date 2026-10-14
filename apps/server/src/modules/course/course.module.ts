import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { AdminCourseController } from './admin-course.controller';

@Module({
  controllers: [CourseController, AdminCourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}

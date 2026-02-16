import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // 1. Create Professor
    const professorPassword = await bcrypt.hash('password123', 10);
    const professor = await prisma.user.upsert({
        where: { email: 'prof@university.edu' },
        update: {},
        create: {
            id: 'user-prof-123',
            email: 'prof@university.edu',
            name: 'Dr. Alan Turing',
            passwordHash: professorPassword,
            role: 'PROFESSOR',
            department: 'Computer Science',
        },
    });

    // 2. Create Course
    const course = await prisma.course.upsert({
        where: { id: 'course-cs101' },
        update: {},
        create: {
            id: 'course-cs101',
            code: 'CS101',
            name: 'Introduction to Algorithms',
            professorId: professor.id,
            aiMode: 'BRAINSTORMING',
        }
    });

    // 3. Create Assignment
    const assignment = await prisma.assignment.upsert({
        where: { id: 'assign-linked-list' },
        update: {},
        create: {
            id: 'assign-linked-list',
            courseId: course.id,
            title: 'Implementing Linked List',
            description: 'Implement a singly linked list with insert, delete, and traverse methods.',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            aiMode: 'BRAINSTORMING',
            codeConstraints: ['No built-in Array methods', 'Max 100 lines'],
        },
    });

    // 4. Create Student
    const studentPassword = await bcrypt.hash('student123', 10);
    const student = await prisma.user.upsert({
        where: { email: 'student@university.edu' },
        update: {},
        create: {
            id: 'user-student-456',
            email: 'student@university.edu',
            name: 'Jane Doe',
            passwordHash: studentPassword,
            role: 'STUDENT',
            universityId: 'S12345678',
        },
    });

    // 5. Enroll Student
    console.log('Upserting enrollment...');
    await prisma.enrollment.upsert({
        where: {
            studentId_courseId: {
                studentId: student.id,
                courseId: course.id,
            }
        },
        update: {},
        create: {
            studentId: student.id,
            courseId: course.id,
        },
    });

    console.log({
        professor: professor.id,
        course: course.id,
        assignment: assignment.id,
        student: student.id,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

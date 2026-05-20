const prisma = require('../utils/prisma');
const { ok: success, notFound } = require('../utils/respond');

/**
 * Public portfolio view.
 * No authentication required.
 */
async function getPublicPortfolio(req, res, next) {
  const { slug } = req.params;
  
  try {
    const intern = await prisma.intern.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          }
        },
        tasks: {
          where: { 
            status: 'completed',
          },
          select: {
            id: true,
            title: true,
            complexity: true,
            skills: true,
            deadline: true,
          }
        }
      }
    });

    if (!intern) {
      return notFound(res, 'Portfolio not found');
    }

    // Transform data for public view
    const portfolioUrl = `${process.env.FRONTEND_URL}/portfolio/${slug}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portfolioUrl)}`;

    const portfolio = {
      name: intern.user.name,
      email: intern.user.email,
      role: intern.user.role,
      bio: intern.bio,
      profilePic: intern.profilePic,
      contactNumber: intern.contactNumber,
      linkedinUrl: intern.linkedinUrl,
      skills: intern.skills,
      completedTasks: intern.tasks,
      portfolioUrl,
      qrCodeUrl,
    };

    return success(res, portfolio);
  } catch (err) {
    next(err);
  }
}

/**
 * Update portfolio details (Intern only)
 */
async function updateMyPortfolio(req, res, next) {
  const userId = req.user.id;
  const { bio, profilePic, contactNumber, linkedinUrl, skills } = req.body;
  
  try {
    const intern = await prisma.intern.findUnique({ where: { userId } });
    if (!intern) return notFound(res, 'Intern record not found');
    
    const updated = await prisma.intern.update({
      where: { id: intern.id },
      data: {
        bio,
        profilePic,
        contactNumber,
        linkedinUrl,
        skills,
      }
    });
    
    return success(res, updated, 'Portfolio updated successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicPortfolio, updateMyPortfolio };

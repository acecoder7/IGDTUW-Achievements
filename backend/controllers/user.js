import User from "../models/User.js";
import Post from "../models/Post.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import ApiFeatures from "../utils/apifeatures.js";


//Register
export const register = async (req,res)=>{
    try {
        const { name, email, password } = req.body;
    
        let user = await User.findOne({ email });
        if (user) {
          return res
            .status(400)
            .json({ success: false, message: "User already exists" });
        }
    
        user = await User.create({
          name,
          email,
          password
        });
    
        const token = await user.generateToken();
    
        const options = {
          expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          httpOnly: true,
        };
    
        res.status(201).cookie("token", token, options).json({
          success: true,
          user,
          token,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Login
export const login = async (req,res)=>{
    try {
        const { email, password } = req.body;
    
        const user = await User.findOne({ email })
          .select("+password")
          .populate("posts");
    
        if (!user) {
          return res.status(400).json({
            success: false,
            message: "User does not exist",
          });
        }
    
        const isMatch = await user.matchPassword(password);
    
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: "Incorrect password",
          });
        }
    
        const token = await user.generateToken();
    
        const options = {
          expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          httpOnly: true,
        };
    
        res.status(200).cookie("token", token, options).json({
          success: true,
          user,
          token,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Logout
export const logout = async (req,res)=>{
    try {
        res
          .status(200)
          .cookie("token", null, { expires: new Date(Date.now()), httpOnly: true })
          .json({
            success: true,
            message: "Logged out",
          });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Update Password
export const updatePassword = async (req,res) => {
    try {
        const user = await User.findById(req.user._id).select("+password");
    
        const { oldPassword, newPassword } = req.body;
    
        if (!oldPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            message: "Please provide old and new password",
          });
        }
    
        const isMatch = await user.matchPassword(oldPassword);
    
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: "Incorrect Old password",
          });
        }
    
        user.password = newPassword;
        await user.save();
    
        res.status(200).json({
          success: true,
          message: "Password Updated",
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Update Profile
export const updateProfile = async (req,res)=> {
    try {
        const user = await User.findById(req.user._id);
    
        const { name, email, course, branch , year } = req.body;
    
        if (name) {
          user.name = name;
        }
        if (email) {
          user.email = email;
        }
        if (course) {
            user.course = course;
        }
        if (branch) {
            user.branch = branch;
        }
        if (year) {
            user.year = year;
        }
    
        await user.save();
    
        res.status(200).json({
          success: true,
          message: "Profile Updated",
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Delete My Profile
export const deleteMyProfile = async (req,res)=> {
    try {
        const user = await User.findById(req.user._id);
        const posts = user.posts;
        const userId = user._id;
    
        await user.remove();
    
        // Logout user after deleting profile
        res.cookie("token", null, {
          expires: new Date(Date.now()),
          httpOnly: true,
        });
    
        // Delete all posts of the user
        for (let i = 0; i < posts.length; i++) {
          const post = await Post.findById(posts[i]);
          await cloudinary.v2.uploader.destroy(post.image.public_id);
          await post.remove();
        }
    
        // removing all comments of the user from all posts
        const allPosts = await Post.find();
    
        for (let i = 0; i < allPosts.length; i++) {
          const post = await Post.findById(allPosts[i]._id);
    
          for (let j = 0; j < post.comments.length; j++) {
            if (post.comments[j].user === userId) {
              post.comments.splice(j, 1);
            }
          }
          await post.save();
        }
        // removing all likes of the user from all posts
    
        for (let i = 0; i < allPosts.length; i++) {
          const post = await Post.findById(allPosts[i]._id);
    
          for (let j = 0; j < post.likes.length; j++) {
            if (post.likes[j] === userId) {
              post.likes.splice(j, 1);
            }
          }
          await post.save();
        }
    
        res.status(200).json({
          success: true,
          message: "Profile Deleted",
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//My Profile
export const myProfile = async (req ,res)=> {
    try {
        const user = await User.findById(req.user._id).populate(
          "posts"
        );
    
        res.status(200).json({
          success: true,
          user,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Get User Profile
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate(
          "posts"
        );
    
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
    
        res.status(200).json({
          success: true,
          user,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Get All Users
export const getAllUsers = async (req, res) => {
    const apiFeatures = new ApiFeatures(User.find(),req.query).search().filter();
    try {
        const users = await apiFeatures.query;
    
        res.status(200).json({
          success: true,
          users,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Forget Password
export const forgotPassword = async (req, res)=> {
    try {
        const user = await User.findOne({ email: req.body.email });
    
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
    
        const resetPasswordToken = user.getResetPasswordToken();
    
        await user.save();
    
        const resetUrl = `${req.protocol}://${req.get("host")}/password/reset/${resetPasswordToken}`;
    
        const message = `Reset Your Password by clicking on the link below: \n\n ${resetUrl}`;
    
        try {
          await sendEmail({
            email: user.email,
            subject: "Reset Password",
            message,
          });
    
          res.status(200).json({
            success: true,
            message: `Email sent to ${user.email}`,
          });
        } catch (error) {
          user.resetPasswordToken = undefined;
          user.resetPasswordExpire = undefined;
          await user.save();
    
          res.status(500).json({
            success: false,
            message: error.message,
          });
        }
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Reset Password
export const resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto
          .createHash("sha256")
          .update(req.params.token)
          .digest("hex");
    
        const user = await User.findOne({
          resetPasswordToken,
          resetPasswordExpire: { $gt: Date.now() },
        });
    
        if (!user) {
          return res.status(401).json({
            success: false,
            message: "Token is invalid or has expired",
          });
        }
    
        user.password = req.body.password;
    
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
    
        res.status(200).json({
          success: true,
          message: "Password Updated",
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Get My Posts
export const getMyPost = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
    
        const posts = [];
    
        for (let i = 0; i < user.posts.length; i++) {
          const post = await Post.findById(user.posts[i]).populate(
            "likes comments.user owner"
          );
          posts.push(post);
        }
    
        res.status(200).json({
          success: true,
          posts,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


//Get User Posts
export const getUserPosts = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
    
        const posts = [];
    
        for (let i = 0; i < user.posts.length; i++) {
          const post = await Post.findById(user.posts[i]).populate(
            "likes comments.user owner"
          );
          posts.push(post);
        }
    
        res.status(200).json({
          success: true,
          posts,
        });
    } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
    }
};


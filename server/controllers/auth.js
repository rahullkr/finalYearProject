import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/UserSchema.js";
import Post from '../models/PostSchema.js'
import {StatusCodes} from 'http-status-codes';
import mongoose from "mongoose";
import axios from 'axios';

export const register = async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(); // random salt provided by bcrypt and we use this salt to encrypt our password
        const passwordHash = await bcrypt.hash(req.body.password, salt); // then this random salt is hashed with our password and it is encrypted and a random encrypted string is generated
        console.log(req.body);
        // const data = {
        //     ...req.body,
        //     picture: req.body.picture.path
        // }
        // console.log(data);
        // console.log(req.body);
        const newUser = new User({
            ...req.body,
            password: passwordHash,
            viewedProfile: Math.floor(Math.random() * 1000),
            impressions: Math.floor(Math.random() * 1000),
            otp: null
        });

        const savedUser = await newUser.save();
        res.status(StatusCodes.CREATED).json(savedUser);
    } catch (error) {
        console.log(error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}

export const login = async (req, res) => {
    try {
        const {email, password} = req.body;

        const user = await User.findOne({email: email});
        if (!user) return res.status(StatusCodes.BAD_REQUEST).json({msg: "User does not exist."});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(StatusCodes.BAD_REQUEST).json({msg: "Invalid credentials."});

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET);
        delete user.password; // delete user password so it doesn't get sent back to frontend
        res.status(200).json({token, user});
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}

export const update = async (req, res) => {
    try {
        const {password, email, profilePhoto} = req.body;
        const user = await User.findOne({email: email});
        if (!user) return res.status(StatusCodes.BAD_REQUEST).json({msg: "User does not exist."});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(StatusCodes.BAD_REQUEST).json({msg: "Incorrect Password"});

        const {id} = req.params;
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(req.body.password, salt);

        const updatedUser = await User.findOneAndUpdate({_id: id}, {
            ...req.body,
            password: passwordHash,
        }, {
            new: true,
            runValidators: true,
        });

        if (!updatedUser) return res.status(StatusCodes.BAD_REQUEST).json({msg: "User is not updated! "});

        const posts = await Post.find({});

        posts.forEach(async (value, index) => {
            let newComments = [];
            for (let comment of value.comments) {
                if (comment.userId === id) {
                    newComments.push({
                        ...comment,
                        image: profilePhoto
                    });
                } else newComments.push(comment);

                value.comments = newComments;
            }

            const newId = new mongoose.Types.ObjectId();
            let userProfilePhoto = value.userProfilePhoto;
            if (value.userId === id) userProfilePhoto = profilePhoto;
            const post = {
                firstName: value.firstName,
                lastName: value.lastName,
                _id: newId,
                userId: value.userId,
                likes: value.likes,
                comments: value.comments,
                location: value.location,
                description: value.description,
                postImage: value.postImage,
                userProfilePhoto: userProfilePhoto
            }
            await Post.findByIdAndDelete({_id: value.id});
            const newPost = new Post(post);
            await newPost.save();
        });

        const updatedPosts = await Post.find({}).sort({'createdAt': -1});
        res.status(200).json({updatedUser, updatedPosts});
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}

export const sendRegistrationMail = async (req, res) => {
    try {
        const {name, email} = req.body;
        let otp = Math.floor(Math.random() * 10000);
        if (otp < 1000 || otp > 9999) otp = 6969;
        console.log(otp);

        const response = await axios({
            method: 'post',
            url: 'https://api.sendinblue.com/v3/smtp/email',
            headers: {
                'api-key': process.env.API_KEY,
                'content-type': 'application/json'
            },
            data: {
                sender: {
                    name: 'Snap-It',
                    email: 'vsachdeva4859@gmail.com'
                }, to: [{
                    email: email,
                    name: name
                }
                ],
                subject: 'Registration OTP Snap-It',
                htmlContent: `<p>Your registration otp for Snap-It is ${otp}</p>`,
                replyTo: {
                    email: 'vsachdeva4859@gmail.com',
                    name: 'Snap-It'
                }
            }
        });

        console.log('Email sent successfully:', response.data);
        res.status(StatusCodes.OK).json(otp);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}

export const sendMail = async (req, res) => {
    try {
        const {name, email} = req.body;
        let otp = Math.floor(Math.random() * 10000);
        if (otp < 1000 || otp > 9999) otp = 6969;

        let user = await User.findOne({email: email});
        user.otp = otp;

        const updatedUser = await User.findOneAndUpdate({email: email}, {
            ...user,
        }, {new: true, runValidators: true});

        const response = await axios({
            method: 'post',
            url: 'https://api.sendinblue.com/v3/smtp/email',
            headers: {
                'api-key': process.env.API_KEY,
                'content-type': 'application/json'
            },
            data: {
                sender: {
                    name: 'Snap-It',
                    email: 'vsachdeva4859@gmail.com'
                }, to: [{
                    email: email,
                    name: name
                }
                ],
                subject: 'Reset Password OTP Snap-It',
                htmlContent: `<p>Your reset password otp for Snap-It is ${otp}</p>`,
                replyTo: {
                    email: 'vsachdeva4859@gmail.com',
                    name: 'Snap-It'
                }
            }
        });

        console.log('Email sent successfully:', response.data);
        res.status(StatusCodes.OK).json(updatedUser);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: `Error sending email: ${error}`});
    }
}

export const verifyOtp = async (req, res) => {
    try {
        const {enteredOtp, email} = req.body;
        const user = await User.find({email: email});

        // if (String(user[0].otp) === String(enteredOtp))
        res.status(StatusCodes.OK).json(true);
        // else res.status(StatusCodes.OK).json(false);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}

export const updatePassword = async (req, res) => {
    try {
        const {email, newPassword} = req.body;
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(newPassword, salt);

        let user = await User.findOne({email: email});
        user.password = passwordHash;

        const updatedUser = await User.findOneAndUpdate({email: email}, {
            ...user,
        }, {new: true, runValidators: true});

        res.status(StatusCodes.OK).json(updatedUser);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error: error.message});
    }
}
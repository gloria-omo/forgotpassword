const userModel = require ('../model/validationModel')
const{myValidate}=require('../helpers/validation')
const bcrypt = require ('bcrypt')
const sendEmail = require('../helpers/email.js')
 require('dotenv').config()
const jwt=require("jsonwebtoken")
const generateDynamicEmail =require('../helpers/index.js')


exports.createUser = async (req, res) => {
    try {
        //  Extracting user data from request body
        const { firstName, lastName, email, phoneNumber, password } = req.body;

        //  Validating user data
        // Assuming myValidate.validateAsync returns a Promise, you can use 'await'
        await myValidate.validateAsync({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phoneNumber,
            password
        });

        //  Generating salted and hashed password
        const saltedPassword = bcrypt.genSaltSync(10);
        const hashPassword = bcrypt.hashSync(password, saltedPassword);

        //  Creating a new user model instance
        const user = new userModel({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phoneNumber,
            password: hashPassword  
        });

        //  Generating JWT token for user authentication
        const userToken = jwt.sign(
            { lastName, firstName, email: user.email },
            process.env.jwtSecret,
            { expiresIn: "300s" }
        );
        user.token = userToken;

        //  Saving the user to the database
        await user.save();

        // Sending a verification email to the user
        
        const link = `${req.protocol}://${req.get('host')}/updateuser/${user._id}/${user.token}`;
        const html = generateDynamicEmail(link, user.firstName.toUpperCase(), user.lastName.toUpperCase().slice(0, 1));
        await sendEmail({
            email: user.email,
            subject:'Kindly verify your account',
            html
        });

        //  Responding with a success message
        res.status(201).json({
            message: `User with email ${user.email} has been successfully created`,
            data: user
        });

    } catch (err) {
        // Handling errors and responding with an error message
        res.status(500).json({
            message: 'Unable to create user',
            error: err.message
        });
    }
};



exports.login = async(req,res)=>{
    try {
       const {email, password} = req.body
    //    check if the user existing in the database
       const userExist = await userModel.findOne({email: email.toLowerCase()})
       if(!userExist){
         return res.status(404).json({
            message:`user does not exist`
        })
       }
    //    check password
       const checkPassword = bcrypt.compareSync(password, userExist.password)
       if(checkPassword===false){
        return res.status(400).json({
            message:`Invalid password`
        })
       }

    //    check if the user is verified


    //    generate a token for the user
    const token = jwt.sign({
         userId : userExist._id,
        userEmail :userExist.email
    },
    process.env.jwtSecret,
    {expiresIn:'1d'});
     userExist.token = token;
    
    const user = await userExist.save();

        res.status(200).json({
            message:`Login successfully`,
            token
        })
       
    
    }catch (err) {
        res.status(500).json({
           message: `unable to login`,
           error: `err.message`
        })
    }
}


exports.verify = async(req,res)=>{
    try{
const id = req.params.id
const userToken = req.params.userToken

jwt.verify(userToken,process.env.jwtsecret)

const verify = await userModel.findByIdAndUpdate(id,{isVerify:true},{new:true})


res.status(200).json({
    message:`user with email:${updatedUser.email} is updated successfully`,
    data:updatedUser
})
}catch(err){
res.status(500).json({
    error: err.message
})
}

}
exports.home = (req ,res)=>{
res.json("welcome api")
}
    
exports.getOne = async(req,res)=>{
    try{
        const id = req.params.id
    const oneUser = await userModel.find(id)

    res.status(200).json({
        messsage: `user with email ${email} has been found`

    })
}catch(err){
res.status(404).json(err.message)
}
}

exports.getAll = async(req,res)=>{
    try{
    const user = await userModel.find()
    const allUser = user.length 
    if(allUser===0){

    res.status(200).json({
        messsage: `There are ${allUser}users in the Database`,
        allUser

    })
}
}catch(err){
res.status(404).json(err.message)
}
}

exports.updateuser = async (req,res)=>{
    try{
const id = req.params.id
const data ={
    firstName:req.body.firstName,
    lastName:req.body.lastName,
    email: req.body.email,
    phoneNumber:req.body.phoneNumber,
}
const user = await userModel.findByIdAndUpdate(id,data,{new:true})
if(!user){
    return res.status(404).json({
        message:`user does not exist`
    })
}
else{
    res.status(200).json({
        message:`updated successfully`
})
    }
}catch(err){
res.status(500).json({
    message: err.message
})
    }
}


exports.signOut =async(req,res)=>{
    try{
const id = req.params.id
const user = await userModel.findById(id)

user.token = null

res.status(200).json({
    message: `signed out successfully `
})
    }catch(err){
res.status(500).json(err.message)
    
}
};


exports.forgotPassword = async(req,res)=>{
    try{
        // Extract user email from the req,body
        const {email} =req.body;

        // find user in the database

        const user = await userModel.findOne({email});

        // check if the user is existing in the database

        if(!user){
            return res.status(404).json({
                message:"user not found"

            })
        }
         // if a user is found generate a token

         const token = jwt.sign({userId:user._id},process.env.jwtSecret,{expiresIn:"10m"});
         console.log(token)

         const link = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
        const html = generateDynamicEmail(link, user.firstName.toUpperCase(), user.lastName.toUpperCase().slice(0, 1));
        await sendEmail({
            email: user.email,
            subject:'reset password',
            html
        });

        // send a respond
        res.status(200).json({
            message:"reset password email sent successfully"
        });


    }
    catch(err){
        res.status(500).json({
           err: err.message
        })
    }
};

exports.resetPassword = async(req,res)=>{
    try{
        // get the token from the params
        const {token}= req.params;
        // Get the new password from  the body 
        const { newPassword, confirmPassword} = req.body;

        if(newPassword !== confirmPassword){
            return res.status(400).json({
                message : "incorrect passsword"
            })
        }

        // verify the validity of the token 
       const decodedToken = jwt.verify(token,process.env.jwtSecret);

    //    find the user of the token 

       const user = await userModel.findById(decodedToken.userId);

       if(!user){
        return res.status(404).json({
            message:"user not found"

        })
       };
    //    encrypt the user new psswword
       const salt =bcrypt.genSaltSync(10);
       const hash =bcrypt.hashSync(newPassword,salt);
    //    updata the user password
       user.password = hash;

    //    save the changes to database
       await user.save();
    //    send a success message
    res.status(200).json({
        message:"password reset sucessfully",
        user
    })

    }
    catch(err){
        res.status(500).json({
            err:err.massage
        })
    }
}